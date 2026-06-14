"""
RAG 상품 벡터 스토어
- 임베딩: jhgan/ko-sroberta-multitask (한국어 sentence-transformers, 로컬)
- 벡터 DB: ChromaDB (로컬 파일 기반)
- 문서: backend/app/data/products/*.md
"""

import os
import re
import hashlib
from pathlib import Path
from typing import Optional

from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document

# ── 경로 설정 ──────────────────────────────────────────────
_BASE_DIR = Path(__file__).resolve().parent.parent
PRODUCTS_DIR = _BASE_DIR / "data" / "products"
CHROMA_DIR = _BASE_DIR / "data" / "chroma_db"

EMBED_MODEL = "jhgan/ko-sroberta-multitask"

# 영역 전용 키워드 — 재무 영역보다 먼저 검사 (특수성 높은 순)
_AREA_SPECIFIC_KEYWORDS = {
    "건강":    ["건강적금", "의료비", "실버케어", "중대질병", "간병", "요양보험", "헬스케어",
                "건강 목적", "건강보험", "장기요양", "건강검진", "수술비", "입원비"],
    "여가활동": ["여가", "여행적금", "문화생활", "취미", "액티브 시니어", "시니어라이프",
                "여행", "문화 ISA", "여가 목적"],
    "대인관계": ["가족사랑", "가족신탁", "커뮤니티", "사회활동", "봉사", "모임",
                "가족 지원", "시니어 커뮤니티"],
}

# 섹션 헤더 → 영역 매핑 (07_virtual_products.md 섹션 구분용)
_SECTION_AREA = {
    "건강 영역": "건강",
    "여가활동 영역": "여가활동",
    "대인관계 영역": "대인관계",
}


def _detect_area(text: str, section_hint: str = "") -> str:
    """상품 텍스트에서 노후 준비 영역을 추론. 특수 영역 키워드 우선 검사."""
    # 섹션 힌트가 있으면 우선 사용
    if section_hint:
        return section_hint

    # 건강·여가·대인관계 특수 키워드 먼저 확인
    for area, keywords in _AREA_SPECIFIC_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return area

    return "재무"


def _parse_md_products(md_path: Path) -> list[Document]:
    """md 파일에서 개별 상품 블록을 파싱하여 Document 리스트로 반환."""
    text = md_path.read_text(encoding="utf-8")

    # 프론트매터에서 is_virtual 판별
    is_virtual = "is_virtual: true" in text

    # 섹션 헤더(## 레벨) 위치를 미리 기록해 각 상품의 섹션 힌트로 활용
    # 예: "## 건강 영역 가상 상품" → "건강"
    section_map: list[tuple[int, str]] = []  # (char_offset, area)
    for m in re.finditer(r"^## (.+)$", text, flags=re.MULTILINE):
        header = m.group(1).strip()
        for key, area_val in _SECTION_AREA.items():
            if key in header:
                section_map.append((m.start(), area_val))
                break

    def _section_hint_at(offset: int) -> str:
        """offset 이전에 등장한 가장 마지막 섹션 힌트 반환."""
        hint = ""
        for pos, area_val in section_map:
            if pos <= offset:
                hint = area_val
        return hint

    # '### ' 로 시작하는 상품 블록 분리 (레벨 3 헤더)
    docs = []
    for m in re.finditer(r"(?:^|\n)(### .+?)(?=\n### |\Z)", text, flags=re.DOTALL):
        block = m.group(1).strip()
        if not block.startswith("###"):
            continue

        block_offset = m.start()

        # 상품명 추출 (첫 줄)
        first_line = block.split("\n")[0]
        name = re.sub(r"^###\s*", "", first_line).strip()

        # 가상 상품 태그 제거한 순수 이름
        clean_name = re.sub(r"\s*\[가상상품\]", "", name).strip()

        # 카테고리·은행 추출
        category = ""
        bank = ""
        for line in block.split("\n"):
            if line.startswith("카테고리:"):
                category = line.replace("카테고리:", "").strip()
            elif line.startswith("은행:"):
                bank = line.replace("은행:", "").strip()

        section_hint = _section_hint_at(block_offset)
        area = _detect_area(block, section_hint)

        # 상품 고유 ID: 이름 해시
        product_id = hashlib.md5(clean_name.encode()).hexdigest()[:8]

        docs.append(Document(
            page_content=block,
            metadata={
                "product_id": product_id,
                "name": clean_name,
                "bank": bank,
                "category": category,
                "area": area,
                "is_virtual": is_virtual,
                "source_file": md_path.name,
            }
        ))

    return docs


def _load_all_products() -> list[Document]:
    """products 디렉토리 내 모든 md 파일을 로드."""
    all_docs = []
    if not PRODUCTS_DIR.exists():
        return all_docs
    for md_file in sorted(PRODUCTS_DIR.glob("*.md")):
        all_docs.extend(_parse_md_products(md_file))
    return all_docs


# ── 싱글턴 벡터 스토어 ──────────────────────────────────────
_vectorstore: Optional[Chroma] = None


def get_vectorstore() -> Chroma:
    """ChromaDB 벡터 스토어를 반환 (최초 1회 빌드)."""
    global _vectorstore
    if _vectorstore is not None:
        return _vectorstore

    embeddings = HuggingFaceEmbeddings(
        model_name=EMBED_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

    # 기존 DB가 있으면 로드, 없으면 새로 생성
    if CHROMA_DIR.exists() and any(CHROMA_DIR.iterdir()):
        _vectorstore = Chroma(
            persist_directory=str(CHROMA_DIR),
            embedding_function=embeddings,
            collection_name="jb_products",
        )
    else:
        docs = _load_all_products()
        if not docs:
            raise RuntimeError("상품 문서를 찾을 수 없습니다. products/*.md 파일을 확인하세요.")
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        _vectorstore = Chroma.from_documents(
            documents=docs,
            embedding=embeddings,
            persist_directory=str(CHROMA_DIR),
            collection_name="jb_products",
        )

    return _vectorstore


def rebuild_vectorstore() -> Chroma:
    """벡터 스토어를 강제 재빌드 (상품 문서 업데이트 후 사용)."""
    global _vectorstore
    import shutil
    if CHROMA_DIR.exists():
        shutil.rmtree(CHROMA_DIR)
    _vectorstore = None
    return get_vectorstore()


def search_products(
    query: str,
    k: int = 6,
    filter_virtual: Optional[bool] = None,
    filter_area: Optional[str] = None,
) -> list[Document]:
    """
    쿼리와 유사한 상품 문서를 검색.
    filter_virtual=True  → 가상 상품만
    filter_virtual=False → 실제 상품만
    filter_virtual=None  → 전체
    filter_area="건강"   → 해당 영역 상품만
    """
    vs = get_vectorstore()
    conditions = []
    if filter_virtual is not None:
        conditions.append({"is_virtual": {"$eq": filter_virtual}})
    if filter_area is not None:
        conditions.append({"area": {"$eq": filter_area}})

    if len(conditions) == 0:
        where = None
    elif len(conditions) == 1:
        where = conditions[0]
    else:
        where = {"$and": conditions}

    results = vs.similarity_search(query, k=k, filter=where)
    return results
