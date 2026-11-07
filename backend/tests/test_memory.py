from datetime import datetime, timezone

from app.memory import MemoryStore
from app.schemas import TriageDecision


def make(priority):
    return TriageDecision(type="feature", area="ui", priority=priority, confidence=0.8, reasoning="r")


def test_save_and_reload(tmp_path):
    mem = MemoryStore(str(tmp_path / "m.db"))
    now = datetime.now(timezone.utc)
    mem.save(7, make("P3"), now, applied=True)
    got = mem.get(7)
    assert got.decision.priority == "P3"
    assert got.applied is True


def test_priority_change_is_tracked(tmp_path):
    mem = MemoryStore(str(tmp_path / "m.db"))
    now = datetime.now(timezone.utc)
    mem.save(7, make("P3"), now, applied=True)
    mem.save(7, make("P1"), now, applied=True, event="rechecked_changed")
    assert mem.get(7).previous_priority == "P3"
    assert [h["event"] for h in mem.history(7)] == ["triaged", "rechecked_changed"]
