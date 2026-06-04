from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.routes.auth import get_current_user_dependency
from app.core.database import get_session
from app.models.db.repository import Repository
from app.models.db.user import User
from app.services.analysis.impact import analyze_impact

router = APIRouter(prefix="/repos", tags=["impact"])


class ImpactRequest(BaseModel):
    symbol: str


class AffectedEndpoint(BaseModel):
    method: Optional[str]
    path: Optional[str]
    file_path: str
    function_name: Optional[str] = None


class ImpactResponse(BaseModel):
    symbol: str
    matched_file: Optional[str]
    risk: str                              # "high" | "medium" | "low"
    direct_dependents: List[str]
    transitive_dependents: List[str]
    affected_endpoints: List[AffectedEndpoint]
    tests_to_run: List[str]
    total_impact: int
    summary: str


@router.post("/{repo_id}/impact", response_model=ImpactResponse)
async def get_impact(
    repo_id: str,
    req: ImpactRequest,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
) -> ImpactResponse:
    """Analyse the blast radius of changing a symbol (file / function / class).

    Returns directly affected files, transitive dependents, touched API
    endpoints, likely test files, a risk level, and an LLM-written summary.
    """
    if not req.symbol.strip():
        raise HTTPException(status_code=400, detail="symbol must not be empty")

    result = await session.execute(
        select(Repository).where(
            (Repository.id == repo_id) & (Repository.user_id == current_user.id)
        )
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if repo.status != "completed":
        raise HTTPException(status_code=400, detail="Repository indexing not completed")
    if not repo.dependency_json:
        raise HTTPException(status_code=400, detail="Dependency graph not available for this repository")

    impact = await analyze_impact(
        symbol=req.symbol.strip(),
        dependency_json=repo.dependency_json or {},
        api_endpoints_json=repo.api_endpoints_json or [],
        repo_name=repo.name,
    )

    return ImpactResponse(
        symbol=impact.symbol,
        matched_file=impact.matched_file,
        risk=impact.risk,
        direct_dependents=impact.direct_dependents,
        transitive_dependents=impact.transitive_dependents,
        affected_endpoints=[
            AffectedEndpoint(
                method=ep.get("method"),
                path=ep.get("path"),
                file_path=ep.get("file_path", ""),
                function_name=ep.get("function_name"),
            )
            for ep in impact.affected_endpoints
        ],
        tests_to_run=impact.tests_to_run,
        total_impact=impact.total_impact,
        summary=impact.summary,
    )
