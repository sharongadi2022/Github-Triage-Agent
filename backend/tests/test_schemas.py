import pytest
from pydantic import ValidationError

from app.schemas import TriageDecision


def test_labels_from_decision():
    d = TriageDecision(type="Bug", area="ui", priority="P0", confidence=0.9,
                       reasoning="crash", needs_more_info=True)
    assert d.to_labels() == ["type/bug", "area/ui", "priority/P0", "needs-more-info"]


def test_unknown_area_falls_back_to_other():
    d = TriageDecision(type="feature", area="spaceships", priority="P3", confidence=0.5, reasoning="x")
    assert d.area == "other"


@pytest.mark.parametrize("bad", [
    {"type": "complaint", "area": "ui", "priority": "P1", "confidence": 0.5, "reasoning": "x"},
    {"type": "bug", "area": "ui", "priority": "P9", "confidence": 0.5, "reasoning": "x"},
    {"type": "bug", "area": "ui", "priority": "P1", "confidence": 1.5, "reasoning": "x"},
])
def test_invalid_decisions_rejected(bad):
    with pytest.raises(ValidationError):
        TriageDecision(**bad)
