"""Ingestion and action layer: everything that talks to GitHub."""
from datetime import datetime
from typing import Iterator, List, Optional

from github import Github

from .schemas import Issue

MAX_BODY_CHARS = 4000  # keep prompts small enough for a local model
MAX_COMMENTS = 10
OUR_LABEL_PREFIXES = ("type/", "area/", "priority/", "needs-more-info")


class GitHubClient:
    def __init__(self, token: str, repo_name: str):
        self._gh = Github(token)
        self.repo = self._gh.get_repo(repo_name)

    # ---------- ingestion ----------
    def fetch_updated(self, since: Optional[datetime] = None) -> Iterator[Issue]:
        """Yield open issues and PRs updated since the last run.

        PyGithub handles pagination; we only pull what changed to stay
        under the API rate limit.
        """
        kwargs = {"state": "open", "sort": "updated", "direction": "desc"}
        if since:
            kwargs["since"] = since
        for raw in self.repo.get_issues(**kwargs):
            if raw.user and raw.user.type == "Bot":
                continue
            yield self._to_issue(raw)

    def _to_issue(self, raw) -> Issue:
        comments: List[str] = []
        if raw.comments:
            for c in raw.get_comments():
                if c.user and c.user.type == "Bot":
                    continue
                comments.append(f"{c.user.login}: {c.body[:500]}")
            comments = comments[-MAX_COMMENTS:]
        reactions = getattr(raw, "reactions", {}) or {}
        return Issue(
            number=raw.number,
            title=raw.title,
            body=(raw.body or "")[:MAX_BODY_CHARS],
            author=raw.user.login if raw.user else "",
            is_pull_request=raw.pull_request is not None,
            labels=[l.name for l in raw.labels],
            comments=comments,
            reactions=int(reactions.get("total_count", 0)),
            updated_at=raw.updated_at,
        )

    # ---------- action ----------
    def apply_labels(self, number: int, new_labels: List[str]) -> None:
        """Replace only the labels this agent owns; keep the maintainers' labels."""
        issue = self.repo.get_issue(number)
        keep = [l.name for l in issue.labels if not l.name.startswith(OUR_LABEL_PREFIXES)]
        issue.set_labels(*(keep + new_labels))

    def comment(self, number: int, text: str) -> None:
        self.repo.get_issue(number).create_comment(text)
