"""Small read-only API the React dashboard can use. Run with:  uvicorn app.main:app --reload"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .memory import MemoryStore

app = FastAPI(title="GitHub Triage Agent API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])
memory = MemoryStore(settings.db_path)


@app.get("/api/health")
def health():
    return {"status": "ok", "repo": settings.github_repo, "dry_run": settings.dry_run}


@app.get("/api/decisions")
def decisions():
    return [
        {
            "issue": d.issue_number,
            "labels": d.decision.to_labels(),
            "priority": d.decision.priority,
            "previous_priority": d.previous_priority,
            "confidence": d.decision.confidence,
            "reasoning": d.decision.reasoning,
            "applied": d.applied,
            "decided_at": d.decided_at.isoformat(),
        }
        for d in memory.all()
    ]


@app.get("/api/decisions/{issue_number}/history")
def history(issue_number: int):
    rows = memory.history(issue_number)
    if not rows:
        raise HTTPException(404, "no decisions for this issue")
    return rows
