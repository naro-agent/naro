import json
import os
from datetime import datetime

FEEDBACK_LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "logs", "feedback.jsonl")


def _ensure_log_dir():
    os.makedirs(os.path.dirname(FEEDBACK_LOG_PATH), exist_ok=True)


def save_feedback(data: dict) -> bool:
    try:
        _ensure_log_dir()
        record = {
            "timestamp": datetime.now().isoformat(),
            **data,
        }
        with open(FEEDBACK_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        return True
    except Exception as e:
        print(f"[feedback_store ERROR] {e}")
        return False


def load_feedback_stats() -> dict:
    try:
        _ensure_log_dir()
        if not os.path.exists(FEEDBACK_LOG_PATH):
            return {"total": 0, "good": 0, "bad": 0, "satisfaction_rate": 0.0, "records": []}

        records = []
        with open(FEEDBACK_LOG_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))

        good = sum(1 for r in records if r.get("rating") == "good")
        bad = sum(1 for r in records if r.get("rating") == "bad")
        total = good + bad
        rate = round(good / total * 100, 1) if total > 0 else 0.0

        # 모드별 통계
        mode_stats = {}
        for r in records:
            mode = r.get("mode", "free")
            if mode not in mode_stats:
                mode_stats[mode] = {"good": 0, "bad": 0}
            mode_stats[mode][r.get("rating", "bad")] += 1

        return {
            "total": total,
            "good": good,
            "bad": bad,
            "satisfaction_rate": rate,
            "mode_stats": mode_stats,
            "recent": records[-10:],  # 최근 10개
        }
    except Exception as e:
        print(f"[feedback_store load ERROR] {e}")
        return {"total": 0, "good": 0, "bad": 0, "satisfaction_rate": 0.0}
