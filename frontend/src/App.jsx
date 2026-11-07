import React, { useState } from "react";
import Demo from "./Demo.jsx";
import { REPO_URL } from "./data.js";

const STACK = [
  ["Python", "Agent logic, glue code and tests."],
  ["LangChain", "Prompt templates and a common interface to the LLM, so the model can be swapped."],
  ["Ollama", "Runs the LLM locally (Llama 3.1). Free, private, no API key."],
  ["PyGithub", "GitHub REST API: read issues and comments, write labels. Handles pagination."],
  ["Pydantic", "Validates the LLM's JSON so bad output never reaches GitHub."],
  ["SQLite", "Memory store for past decisions and their history. Zero setup."],
  ["FastAPI", "Small read-only API that serves decisions to the dashboard."],
  ["React + Vite", "This page: project explainer and the interactive demo."],
  ["pytest", "Unit + integration tests with a fake LLM and fake GitHub."],
];

const ARCH = [
  ["It reads", "Ingestion layer", "backend/app/github_client.py", "Polls GitHub for issues/PRs updated since the last run and cleans them up."],
  ["It decides with a checklist", "Agent core (rubric + LLM)", "backend/app/rubric.py, agent.py", "Rubric prompt filled by LangChain, answered by a local model on Ollama."],
  ["Clean answer", "Output validator", "backend/app/schemas.py", "Pydantic model of the decision. Invalid JSON is retried."],
  ["It acts", "Action layer", "backend/app/github_client.py", "Writes labels through the GitHub API (only the labels the agent owns)."],
  ["It remembers", "Memory store", "backend/app/memory.py", "SQLite tables for the latest decision and the full history."],
  ["It re-checks", "Re-evaluation loop", "backend/app/agent.py → recheck()", "On new activity, old decision + new comments go back to the LLM."],
  ["Maintainer sees it", "API + dashboard", "backend/app/main.py, frontend/", "FastAPI endpoints and this React page."],
];

const RUBRIC = [
  ["P0", "Crash, data loss, security hole, main workflow blocked"],
  ["P1", "Important feature broken with no workaround, or many users affected"],
  ["P2", "Annoying, but a workaround exists"],
  ["P3", "Cosmetic, typo, nice-to-have"],
];

const TREE = `github-triage-agent/
├── backend/
│   ├── app/
│   │   ├── config.py         # settings from .env
│   │   ├── github_client.py  # ingestion + action layer
│   │   ├── rubric.py         # the rubric prompts
│   │   ├── schemas.py        # Pydantic models (validator)
│   │   ├── agent.py          # triage + re-check logic
│   │   ├── memory.py         # SQLite memory store
│   │   ├── run_agent.py      # polling loop
│   │   └── main.py           # FastAPI for the dashboard
│   ├── tests/                # pytest (fake LLM + fake GitHub)
│   ├── requirements.txt
│   └── .env.example
├── frontend/                 # React + Vite (this page)
└── docs/                     # built site for GitHub Pages`;

function Section({ id, eyebrow, title, children }) {
  return (
    <section id={id} className="section">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Diagram() {
  return (
    <div className="diagram" role="img" aria-label="Architecture: GitHub to ingestion, agent core with memory, validator, action layer back to GitHub, and dashboard">
      <div className="node github">GitHub<small>issues · PRs · comments</small></div>
      <div className="arrow">↓ fetch new / updated</div>
      <div className="node">Ingestion layer<small>PyGithub · polling</small></div>
      <div className="arrow">↓</div>
      <div className="row">
        <div className="node core">Agent core<small>rubric prompt · LangChain · Ollama</small></div>
        <div className="arrow side">⇄</div>
        <div className="node mem">Memory store<small>SQLite · past decisions</small></div>
      </div>
      <div className="arrow">↓ JSON</div>
      <div className="node">Validator<small>Pydantic · retry on bad output</small></div>
      <div className="arrow">↓</div>
      <div className="node">Action layer<small>apply labels · confidence ≥ 0.6</small></div>
      <div className="arrow">↓</div>
      <div className="node ui">FastAPI → React dashboard</div>
      <p className="loop-note">↺ New comments or reactions on an old issue send it back through the agent core with its stored decision. That loop is what makes it an agent, not a one-shot classifier.</p>
    </div>
  );
}

export default function App() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="nav">
        <a href="#top" className="brand">🏷️ Triage Agent</a>
        <button className="menu" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
        <nav className={open ? "open" : ""} onClick={() => setOpen(false)}>
          <a href="#demo">Demo</a>
          <a href="#how">How it works</a>
          <a href="#architecture">Architecture</a>
          <a href="#rubric">Rubric</a>
          <a href="#stack">Stack</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">LLM agent · LangChain · Ollama · GitHub API</p>
          <h1>GitHub Triage Agent</h1>
          <p className="lead">
            An autonomous agent that labels and prioritizes GitHub issues and pull requests using an
            LLM-driven rubric, and re-checks its past decisions to correct itself as new activity comes in.
          </p>
          <div className="cta">
            <a className="btn primary" href="#demo">Try the demo</a>
            <a className="btn" href={REPO_URL} target="_blank" rel="noreferrer">View the code</a>
          </div>
          <div className="pillars">
            <div><b>Reads</b><span>new issues & PRs</span></div>
            <div><b>Decides</b><span>with a clear rubric</span></div>
            <div><b>Acts</b><span>applies labels</span></div>
            <div><b>Re-checks</b><span>when things change</span></div>
          </div>
        </section>

        <Section id="problem" eyebrow="Why" title="The problem">
          <div className="two">
            <div className="card">
              <h3>Without it</h3>
              <p>Busy projects get dozens of issues a day. Someone has to read each one, label it and decide what's urgent. Critical bugs get buried under feature requests and questions.</p>
            </div>
            <div className="card accent">
              <h3>With it</h3>
              <p>Every new item is labelled with type, area and priority within minutes, with a written reason. When the discussion changes, say 40 people say they need it, the agent revisits its own call.</p>
            </div>
          </div>
          <p className="analogy">Think of a nurse doing triage in an emergency room: decide who's urgent, and move a patient up if they get worse.</p>
        </Section>

        <Section id="demo" eyebrow="Interactive" title="Demo">
          <p className="muted">
            This demo runs in your browser with recorded agent outputs, so it works without a server.
            The real agent in <code>backend/</code> produces the same JSON by running the rubric on a local model.
          </p>
          <Demo />
        </Section>

        <Section id="how" eyebrow="Flow" title="How one issue moves through the system">
          <ol className="steps">
            <li><b>Ingest.</b> Every few minutes the agent asks GitHub for open issues/PRs updated since its last run (PyGithub handles pagination and only changed items are fetched, which keeps API usage low).</li>
            <li><b>Build context.</b> Title, body, recent human comments and reaction count are trimmed to fit a small model and inserted into the rubric prompt with LangChain.</li>
            <li><b>Decide.</b> The local LLM (Ollama, temperature 0, JSON mode) returns type, area, priority, confidence and reasoning.</li>
            <li><b>Validate.</b> Pydantic checks the answer. Unknown labels or malformed JSON trigger a retry, up to three times.</li>
            <li><b>Act.</b> If confidence ≥ 0.6, the agent sets its labels on GitHub, leaving the maintainers' own labels alone. Low-confidence items are left for a human. A dry-run mode logs without writing.</li>
            <li><b>Remember.</b> The decision and the issue's last-updated time are saved to SQLite, with a full history.</li>
            <li><b>Re-check.</b> When an item's updated time moves past the stored one, the old decision and the new activity go back to the LLM. It only overturns itself if it is clearly more confident (+0.15), which stops flip-flopping, and it posts a comment explaining the change.</li>
          </ol>
        </Section>

        <Section id="architecture" eyebrow="Design" title="Architecture">
          <Diagram />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Story step</th><th>Component</th><th>File</th><th>What it does</th></tr></thead>
              <tbody>
                {ARCH.map(([a, b, c, d]) => (
                  <tr key={b + a}><td>{a}</td><td><b>{b}</b></td><td><code>{c}</code></td><td>{d}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="rubric" eyebrow="The core idea" title="The rubric">
          <p className="muted">The rubric is plain text inside the prompt (<code>backend/app/rubric.py</code>), like a marking scheme. It makes the LLM's output consistent and explainable, and behaviour can be tuned by editing the rules, not the code.</p>
          <div className="two">
            <div className="card">
              <h3>Criteria</h3>
              <ul className="plain">
                <li><b>Type</b>: bug · feature · question · docs</li>
                <li><b>Area</b>: ui · api · performance · security · accessibility · build · other</li>
                <li><b>Clarity</b>: no repro steps → <code>needs-more-info</code></li>
                <li><b>Impact</b>: many 👍 or "same here" raises priority one level</li>
                <li><b>Confidence</b>: 0–1, below 0.6 goes to a human</li>
              </ul>
            </div>
            <div className="card">
              <h3>Priority scale</h3>
              <table className="mini">
                <tbody>
                  {RUBRIC.map(([p, d]) => (
                    <tr key={p}><td><span className={`pill pri-${p}`}>{p}</span></td><td>{d}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <pre className="code">{`{
  "type": "bug",
  "area": "ui",
  "priority": "P0",
  "confidence": 0.93,
  "reasoning": "Crash with data loss and clear reproduction steps.",
  "needs_more_info": false
}`}</pre>
        </Section>

        <Section id="stack" eyebrow="Tools" title="Tech stack and why">
          <div className="stack">
            {STACK.map(([name, why]) => (
              <div className="card small" key={name}><h3>{name}</h3><p>{why}</p></div>
            ))}
          </div>
        </Section>

        <Section id="code" eyebrow="Repository" title="Project structure">
          <pre className="code tree">{TREE}</pre>
          <div className="two">
            <div className="card">
              <h3>Run the agent</h3>
              <pre className="code">{`cd backend
pip install -r requirements.txt
cp .env.example .env   # add token + repo
ollama pull llama3.1
python -m app.run_agent`}</pre>
            </div>
            <div className="card">
              <h3>Tests</h3>
              <pre className="code">{`cd backend
pytest`}</pre>
              <p className="muted">Covers JSON validation, retry on bad output, memory, the full triage → re-check loop, and the anti-flip-flop rule, using a fake LLM and fake GitHub.</p>
            </div>
          </div>
        </Section>
      </main>

      <footer>
        <p>GitHub Triage Agent · <a href={REPO_URL} target="_blank" rel="noreferrer">source on GitHub</a></p>
      </footer>
    </>
  );
}
