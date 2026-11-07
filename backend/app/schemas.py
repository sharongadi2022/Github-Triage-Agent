"""Data shapes shared across the agent."""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

ALLOWED_TYPES = ["bug", "feature", "question", "docs"]
ALLOWED_AREAS = ["ui", "api", "performance", "security", "accessibility", "build", "other"]
Priority = Literal["P0", "P1", "P2", "P3"]


class Issue(BaseModel):
    """A cleaned-up GitHub issue or PR, ready to hand to the LLM."""

    number: int
    title: str
    body: str = ""
    author: str = ""
    is_pull_request: bool = False
    labels: List[str] = []
    comments: List[str] = []
    reactions: int = 0
    updated_at: datetime


class TriageDecision(BaseModel):
    """What the LLM must return. Anything else is rejected and retried."""

    type: str
    area: str
    priority: Priority
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str
    needs_more_info: bool = False

    @field_validator("type")
    @classmethod
    def check_type(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in ALLOWED_TYPES:
            raise ValueError(f"type must be one of {ALLOWED_TYPES}")
        return v

    @field_validator("area")
    @classmethod
    def check_area(cls, v: str) -> str:
        v = v.lower().strip()
        return v if v in ALLOWED_AREAS else "other"

    def to_labels(self) -> List[str]:
        labels = [f"type/{self.type}", f"area/{self.area}", f"priority/{self.priority}"]
        if self.needs_more_info:
            labels.append("needs-more-info")
        return labels


class RecheckDecision(TriageDecision):
    """Re-evaluation output: the same fields plus whether the old call still holds."""

    still_valid: bool


class StoredDecision(BaseModel):
    """A row from the memory store."""

    issue_number: int
    decision: TriageDecision
    issue_updated_at: datetime
    decided_at: datetime
    applied: bool
    previous_priority: Optional[str] = None
