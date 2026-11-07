"""Agent core: rubric + LLM, structured output, memory and self-correction."""
import json
import logging
import re
from typing import Optional, Tuple, Type, TypeVar

from langchain_core.language_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, ValidationError

from .rubric import RECHECK_PROMPT, TRIAGE_PROMPT
from .schemas import Issue, RecheckDecision, StoredDecision, TriageDecision

log = logging.getLogger("triage")
T = TypeVar("T", bound=BaseModel)
MAX_RETRIES = 3


def build_ollama_llm(model: str, base_url: str) -> BaseChatModel:
    """Local LLM through Ollama. format='json' asks the model for JSON only."""
    from langchain_ollama import ChatOllama

    return ChatOllama(model=model, base_url=base_url, temperature=0, format="json")


def extract_json(text: str) -> dict:
    """Pull the first {...} block out of the reply (small models sometimes add chatter)."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("no JSON object in model output")
    return json.loads(match.group(0))


class TriageAgent:
    def __init__(self, llm: BaseChatModel, confidence_threshold: float = 0.6,
                 overturn_margin: float = 0.15):
        self.llm = llm
        self.confidence_threshold = confidence_threshold
        self.overturn_margin = overturn_margin
        self.triage_prompt = ChatPromptTemplate.from_template(TRIAGE_PROMPT)
        self.recheck_prompt = ChatPromptTemplate.from_template(RECHECK_PROMPT)

    # ---------- helpers ----------
    @staticmethod
    def _fields(issue: Issue) -> dict:
        return {
            "kind": "pull request" if issue.is_pull_request else "issue",
            "title": issue.title,
            "author": issue.author,
            "reactions": issue.reactions,
            "body": issue.body or "(empty)",
            "comments": "\n".join(f"- {c}" for c in issue.comments) or "(none)",
        }

    def _ask(self, prompt: ChatPromptTemplate, fields: dict, schema: Type[T]) -> T:
        """Call the LLM and validate the answer, retrying on bad JSON."""
        chain = prompt | self.llm
        last_error: Optional[Exception] = None
        for attempt in range(1, MAX_RETRIES + 1):
            reply = chain.invoke(fields)
            try:
                return schema(**extract_json(reply.content))
            except (ValueError, ValidationError) as err:
                last_error = err
                log.warning("invalid LLM output (attempt %d): %s", attempt, err)
        raise RuntimeError(f"LLM gave invalid output {MAX_RETRIES} times: {last_error}")

    # ---------- public ----------
    def triage(self, issue: Issue) -> TriageDecision:
        return self._ask(self.triage_prompt, self._fields(issue), TriageDecision)

    def recheck(self, issue: Issue, previous: TriageDecision) -> Tuple[TriageDecision, bool]:
        """Re-evaluate an old decision. Returns (decision_to_keep, changed?)."""
        fields = self._fields(issue)
        fields["previous"] = previous.model_dump_json(indent=2)
        result = self._ask(self.recheck_prompt, fields, RecheckDecision)

        # Anti flip-flop: overturning needs clearly more confidence than the original.
        if result.still_valid or round(result.confidence - previous.confidence, 6) < self.overturn_margin:
            return previous, False
        new = TriageDecision(**result.model_dump(include=set(TriageDecision.model_fields)))
        return new, new.to_labels() != previous.to_labels()

    def should_apply(self, decision: TriageDecision) -> bool:
        return decision.confidence >= self.confidence_threshold

    def process(self, issue: Issue, stored: Optional[StoredDecision]):
        """Decide what to do with one item.

        Returns (decision, event) where event is one of:
        'triaged', 'rechecked_changed', 'rechecked_kept', or None (nothing new).
        """
        if stored is None:
            return self.triage(issue), "triaged"
        if issue.updated_at <= stored.issue_updated_at:
            return stored.decision, None
        decision, changed = self.recheck(issue, stored.decision)
        return decision, "rechecked_changed" if changed else "rechecked_kept"
