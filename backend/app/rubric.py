"""The rubric: plain-language rules the LLM uses to grade every issue.

Changing triage behaviour usually means editing this file, not the code.
"""

RUBRIC = """
You are a triage assistant for a GitHub repository. Grade the item using this rubric.

1. TYPE (pick one)
   - bug: something that used to work, or should work, is broken
   - feature: a request for new behaviour
   - question: the author needs help or an explanation
   - docs: README, guides, typos or examples

2. AREA (pick one): ui, api, performance, security, accessibility, build, other

3. PRIORITY
   - P0: crash, data loss, security hole, or the main workflow is blocked for many users
   - P1: an important feature is broken with no workaround, or many users are affected
   - P2: annoying, but a workaround exists
   - P3: cosmetic, typo, nice-to-have

4. CLARITY
   Set needs_more_info to true if a bug report has no steps to reproduce
   and no error message.

5. IMPACT
   Many thumbs-up reactions or "same here" comments raise priority by one level.
   Accessibility problems that block users are at least P1.

6. CONFIDENCE
   A number from 0 to 1. Use below 0.6 when the item is vague or could fit
   two categories.

EXAMPLES
- "App crashes and deletes my notes when I click Save" -> bug, ui, P0
- "Add dark mode please" (2 reactions) -> feature, ui, P3
- "How do I install on Windows?" -> question, build, P3
- "Typo in README install section" -> docs, other, P3
"""

TRIAGE_PROMPT = RUBRIC + """
ITEM
Kind: {kind}
Title: {title}
Author: {author}
Reactions: {reactions}
Body:
{body}

Recent comments:
{comments}

Answer with ONLY a JSON object with these keys:
type, area, priority, confidence, reasoning, needs_more_info
"""

RECHECK_PROMPT = RUBRIC + """
Earlier you triaged this item as:
{previous}

Since then, new activity has arrived.

ITEM (current state)
Kind: {kind}
Title: {title}
Reactions: {reactions}
Body:
{body}

All comments so far:
{comments}

Given the new information, is the earlier decision still right?
Only change it if the new activity clearly justifies a change.

Answer with ONLY a JSON object with these keys:
still_valid, type, area, priority, confidence, reasoning, needs_more_info
"""
