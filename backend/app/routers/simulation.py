from fastapi import APIRouter, HTTPException
from app.schemas import SimulationRequest, SimulationResult
from app.agents.simulation_agent import run_simulation

router = APIRouter()


@router.post("/simulation", response_model=SimulationResult)
async def simulate(req: SimulationRequest):
    try:
        return await run_simulation(req.profile)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
