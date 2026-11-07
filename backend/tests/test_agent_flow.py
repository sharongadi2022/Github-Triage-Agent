"""Integration test of the agent loop with a fake LLM and fake GitHub (no network)."""
import json
from datetime import datetime, timedelta, timezone

from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app import run_agent
from app.agent import TriageAgent
from app.memory import MemoryStore
from app.schemas import Issue, TriageDecision

T0 = datetime(2026, 10, 1, tzinfo=timezone.utc)


def reply(**kw):
    base = {"type": "feature", "area": "ui", "priority": "P3", "confidence": 0.8,
            "reasoning": "nice-to-have", "needs_more_info": False}
    base.update(kw)
    return json.dumps(base)


class FakeGitHub:
    def __init__(self, issues):
        self.issues = issues
        self.applied = {}
        self.comments = {}

    def fetch_updated(self, since=None):
        return iter(self.issues)

    def apply_labels(self, number, labels):
        self.applied[number] = labels

    def comment(self, number, text):
        self.comments[number] = text


def test_retry_on_bad_json():
    llm = FakeListChatModel(responses=["sure! here you go", reply(type="bug", priority="P0")])
    agent = TriageAgent(llm)
    issue = Issue(number=1, title="App crashes on save", updated_at=T0)
    assert agent.triage(issue).priority == "P0"


def test_triage_then_self_correct(tmp_path):
    issue = Issue(number=42, title="Add dark mode", reactions=2, updated_at=T0)
    llm = FakeListChatModel(responses=[
        reply(),  # first triage: P3
        reply(still_valid=False, priority="P1", area="accessibility", confidence=0.95,
              reasoning="40 users and an accessibility concern"),
    ])
    agent = TriageAgent(llm)
    memory = MemoryStore(str(tmp_path / "m.db"))
    gh = FakeGitHub([issue])

    run_agent.run_once(gh, agent, memory, dry_run=False)
    assert gh.applied[42] == ["type/feature", "area/ui", "priority/P3"]

    # New activity arrives later
    gh.issues = [issue.model_copy(update={
        "reactions": 40,
        "comments": ["user1: I need this too, light theme hurts my eyes"],
        "updated_at": datetime.now(timezone.utc) + timedelta(hours=1),
    })]
    run_agent.run_once(gh, agent, memory, dry_run=False)

    assert gh.applied[42] == ["type/feature", "area/accessibility", "priority/P1"]
    assert 42 in gh.comments
    assert memory.get(42).previous_priority == "P3"


def test_weak_overturn_is_ignored():
    llm = FakeListChatModel(responses=[reply(still_valid=False, priority="P2", confidence=0.85)])
    agent = TriageAgent(llm, overturn_margin=0.15)
    old = TriageDecision(type="feature", area="ui", priority="P3", confidence=0.8, reasoning="r")
    decision, changed = agent.recheck(Issue(number=3, title="x", updated_at=T0), old)
    assert changed is False and decision.priority == "P3"
