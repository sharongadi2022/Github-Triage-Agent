// Sample issues and recorded agent outputs used by the in-browser demo.
// The real agent produces the same JSON shape (see backend/app/schemas.py).

export const REPO_URL = "https://github.com/sharongadi2022/github-triage-agent";

export const ISSUES = [
  {
    number: 101,
    kind: "issue",
    title: "App crashes and deletes my notes when I click Save",
    body: "Since v2.3, clicking Save on a long note freezes the app, then it closes. When I reopen it, the note is gone. Steps: 1) open a note over 5,000 words 2) click Save.",
    author: "maria-dev",
    reactions: 6,
    comments: [],
    decision: {
      type: "bug", area: "ui", priority: "P0", confidence: 0.93, needs_more_info: false,
      reasoning: "Crash with data loss and clear reproduction steps. Rubric rule: crash or data loss is P0.",
    },
  },
  {
    number: 102,
    kind: "issue",
    title: "Add dark mode",
    body: "Would be nice to have a dark theme for working at night.",
    author: "sam_k",
    reactions: 2,
    comments: [],
    decision: {
      type: "feature", area: "ui", priority: "P3", confidence: 0.78, needs_more_info: false,
      reasoning: "New behaviour request with low engagement. Nice-to-have, so P3.",
    },
    activity: {
      reactions: 40,
      comments: [
        "priya: I need this too, the white screen gives me migraines.",
        "jlee: I'm low-vision and the light theme is hard to read. This blocks me from using the app for long.",
        "+ 36 more \"same here\" comments",
      ],
      recheck: {
        still_valid: false, type: "feature", area: "accessibility", priority: "P1", confidence: 0.95, needs_more_info: false,
        reasoning: "Reactions grew from 2 to 40 and users report it blocks them for accessibility reasons. Rubric: high impact raises priority, and blocking accessibility issues are at least P1.",
      },
    },
  },
  {
    number: 103,
    kind: "issue",
    title: "How do I install this on Windows?",
    body: "The README only shows the Mac steps. What do I run on Windows 11?",
    author: "newbie42",
    reactions: 1,
    comments: [],
    decision: {
      type: "question", area: "build", priority: "P3", confidence: 0.88, needs_more_info: false,
      reasoning: "The author is asking for help, not reporting something broken.",
    },
  },
  {
    number: 104,
    kind: "pull request",
    title: "Fix typo in README install section",
    body: "Changes `pip instal` to `pip install`.",
    author: "typo-hunter",
    reactions: 0,
    comments: [],
    decision: {
      type: "docs", area: "other", priority: "P3", confidence: 0.97, needs_more_info: false,
      reasoning: "One-word README fix. Docs change, cosmetic, P3.",
    },
  },
  {
    number: 105,
    kind: "issue",
    title: "Login sometimes doesn't work",
    body: "It fails sometimes.",
    author: "anon-user",
    reactions: 0,
    comments: [],
    decision: {
      type: "bug", area: "api", priority: "P2", confidence: 0.48, needs_more_info: true,
      reasoning: "Probably a bug, but there are no steps, no error message and no platform. Confidence is below the 0.6 threshold, so it goes to a human.",
    },
  },
];

export const THRESHOLD = 0.6;
export const OVERTURN_MARGIN = 0.15;

export function toLabels(d) {
  const labels = [`type/${d.type}`, `area/${d.area}`, `priority/${d.priority}`];
  if (d.needs_more_info) labels.push("needs-more-info");
  return labels;
}

export const TRIAGE_STEPS = [
  { key: "ingest", title: "Ingestion", text: "Fetch the issue via the GitHub API, drop bot comments, trim long text." },
  { key: "llm", title: "Rubric + LLM", text: "LangChain fills the rubric prompt; Ollama runs the model locally." },
  { key: "validate", title: "Validate", text: "Pydantic checks the JSON. Bad output is retried (up to 3 times)." },
  { key: "act", title: "Apply labels", text: "If confidence ≥ 0.6, labels are written to GitHub. Otherwise a human decides." },
  { key: "memory", title: "Save to memory", text: "The decision, reasoning and timestamp go into SQLite." },
];

export const RECHECK_STEPS = [
  { key: "ingest", title: "New activity", text: "Polling sees the issue's updated_at changed since the stored decision." },
  { key: "memory", title: "Load memory", text: "The earlier decision is loaded from SQLite." },
  { key: "llm", title: "Re-check prompt", text: "The LLM gets the old decision + new comments: \"Is this still right?\"" },
  { key: "validate", title: "Anti flip-flop", text: "Only overturn if new confidence beats the old by ≥ 0.15." },
  { key: "act", title: "Update + explain", text: "Labels are updated and a comment explains why." },
];
