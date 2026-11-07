"""Polling loop: fetch -> decide -> apply -> remember. Run with:  python -m app.run_agent"""
import logging
import time
from datetime import datetime, timezone

from .agent import TriageAgent, build_ollama_llm
from .config import settings
from .github_client import GitHubClient
from .memory import MemoryStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("triage")


def run_once(gh: GitHubClient, agent: TriageAgent, memory: MemoryStore,
             dry_run: bool = settings.dry_run) -> int:
    started = datetime.now(timezone.utc)
    handled = 0
    for issue in gh.fetch_updated(since=memory.last_run()):
        stored = memory.get(issue.number)
        try:
            decision, event = agent.process(issue, stored)
        except RuntimeError as err:
            log.error("#%d skipped: %s", issue.number, err)
            continue
        if event is None:
            continue

        apply = agent.should_apply(decision) and event != "rechecked_kept"
        if apply and not dry_run:
            gh.apply_labels(issue.number, decision.to_labels())
            if event == "rechecked_changed":
                gh.comment(issue.number, f"Triage updated after new activity: {decision.reasoning}")
        elif not agent.should_apply(decision):
            log.info("#%d low confidence (%.2f): left for a human", issue.number, decision.confidence)

        # Our own label edit bumps updated_at, so remember "now" to avoid re-checking ourselves.
        memory.save(issue.number, decision, max(issue.updated_at, datetime.now(timezone.utc)),
                    applied=apply and not dry_run, event=event)
        log.info("#%d %s -> %s (%.2f)", issue.number, event, decision.to_labels(), decision.confidence)
        handled += 1

    memory.set_last_run(started)
    return handled


def main() -> None:
    gh = GitHubClient(settings.github_token, settings.github_repo)
    agent = TriageAgent(
        build_ollama_llm(settings.ollama_model, settings.ollama_base_url),
        confidence_threshold=settings.confidence_threshold,
        overturn_margin=settings.overturn_margin,
    )
    memory = MemoryStore(settings.db_path)
    log.info("Triage agent started on %s (dry_run=%s)", settings.github_repo, settings.dry_run)
    while True:
        count = run_once(gh, agent, memory)
        log.info("run finished: %d items handled; sleeping %ds", count, settings.poll_interval)
        time.sleep(settings.poll_interval)


if __name__ == "__main__":
    main()
