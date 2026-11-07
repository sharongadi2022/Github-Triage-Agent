"""Memory store: every decision the agent makes, kept in SQLite."""
import json
import sqlite3
from datetime import datetime, timezone
from typing import List, Optional

from .schemas import StoredDecision, TriageDecision

SCHEMA = """
CREATE TABLE IF NOT EXISTS decisions (
    issue_number      INTEGER PRIMARY KEY,
    decision_json     TEXT NOT NULL,
    issue_updated_at  TEXT NOT NULL,
    decided_at        TEXT NOT NULL,
    applied           INTEGER NOT NULL,
    previous_priority TEXT
);
CREATE TABLE IF NOT EXISTS history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_number  INTEGER NOT NULL,
    event         TEXT NOT NULL,          -- triaged | rechecked_kept | rechecked_changed
    decision_json TEXT NOT NULL,
    created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


class MemoryStore:
    def __init__(self, path: str = "triage_memory.db"):
        self.conn = sqlite3.connect(path)
        self.conn.executescript(SCHEMA)

    def get(self, issue_number: int) -> Optional[StoredDecision]:
        row = self.conn.execute(
            "SELECT issue_number, decision_json, issue_updated_at, decided_at, applied, previous_priority "
            "FROM decisions WHERE issue_number = ?",
            (issue_number,),
        ).fetchone()
        if not row:
            return None
        return StoredDecision(
            issue_number=row[0],
            decision=TriageDecision(**json.loads(row[1])),
            issue_updated_at=datetime.fromisoformat(row[2]),
            decided_at=datetime.fromisoformat(row[3]),
            applied=bool(row[4]),
            previous_priority=row[5],
        )

    def save(self, issue_number: int, decision: TriageDecision, issue_updated_at: datetime,
             applied: bool, event: str = "triaged") -> None:
        old = self.get(issue_number)
        prev = old.decision.priority if old and old.decision.priority != decision.priority else None
        now = datetime.now(timezone.utc).isoformat()
        payload = decision.model_dump_json(include=set(TriageDecision.model_fields))
        self.conn.execute(
            "INSERT OR REPLACE INTO decisions VALUES (?, ?, ?, ?, ?, ?)",
            (issue_number, payload, issue_updated_at.isoformat(), now, int(applied), prev),
        )
        self.conn.execute(
            "INSERT INTO history (issue_number, event, decision_json, created_at) VALUES (?, ?, ?, ?)",
            (issue_number, event, payload, now),
        )
        self.conn.commit()

    def all(self) -> List[StoredDecision]:
        nums = [r[0] for r in self.conn.execute("SELECT issue_number FROM decisions ORDER BY decided_at DESC")]
        return [self.get(n) for n in nums]

    def history(self, issue_number: int) -> List[dict]:
        rows = self.conn.execute(
            "SELECT event, decision_json, created_at FROM history WHERE issue_number = ? ORDER BY id",
            (issue_number,),
        )
        return [{"event": e, "decision": json.loads(d), "at": t} for e, d, t in rows]

    def last_run(self) -> Optional[datetime]:
        row = self.conn.execute("SELECT value FROM state WHERE key = 'last_run'").fetchone()
        return datetime.fromisoformat(row[0]) if row else None

    def set_last_run(self, when: datetime) -> None:
        self.conn.execute("INSERT OR REPLACE INTO state VALUES ('last_run', ?)", (when.isoformat(),))
        self.conn.commit()
