import React, { useRef, useState } from "react";
import { ISSUES, RECHECK_STEPS, THRESHOLD, TRIAGE_STEPS, toLabels } from "./data.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Label({ name }) {
  const kind = name.split("/")[0];
  const pri = name.startsWith("priority/") ? ` pri-${name.split("/")[1]}` : "";
  return <span className={`label l-${kind}${pri}`}>{name}</span>;
}

export default function Demo() {
  const [selected, setSelected] = useState(ISSUES[0].number);
  const [memory, setMemory] = useState({}); // number -> { decision, applied, previous, history }
  const [activity, setActivity] = useState({}); // number -> true once new activity arrived
  const [run, setRun] = useState(null); // { mode, step, number }
  const [output, setOutput] = useState(null);
  const busy = useRef(false);

  const issue = ISSUES.find((i) => i.number === selected);
  const view = activity[issue.number]
    ? { ...issue, reactions: issue.activity.reactions, comments: issue.activity.comments }
    : issue;
  const stored = memory[issue.number];
  const steps = run?.mode === "recheck" ? RECHECK_STEPS : TRIAGE_STEPS;

  async function animate(mode, number) {
    const list = mode === "recheck" ? RECHECK_STEPS : TRIAGE_STEPS;
    for (let s = 0; s < list.length; s++) {
      setRun({ mode, step: s, number });
      await sleep(650);
    }
    setRun({ mode, step: list.length, number });
  }

  async function triage(target = issue) {
    if (busy.current) return;
    busy.current = true;
    setSelected(target.number);
    setOutput(null);
    await animate("triage", target.number);
    const d = target.decision;
    const applied = d.confidence >= THRESHOLD;
    setOutput({ mode: "triage", decision: d, applied });
    setMemory((m) => ({
      ...m,
      [target.number]: { decision: d, applied, previous: null, history: [{ event: "triaged", priority: d.priority, at: now() }] },
    }));
    busy.current = false;
  }

  async function triageAll() {
    for (const i of ISSUES) {
      if (!memory[i.number]) await triage(i);
    }
  }

  async function newActivity() {
    if (busy.current) return;
    busy.current = true;
    setActivity((a) => ({ ...a, [issue.number]: true }));
    setOutput(null);
    await sleep(400);
    await animate("recheck", issue.number);
    const r = issue.activity.recheck;
    const old = memory[issue.number].decision;
    const changed = !r.still_valid && r.confidence - old.confidence >= 0.15 - 1e-9;
    setOutput({ mode: "recheck", decision: r, previous: old, changed, applied: true });
    setMemory((m) => ({
      ...m,
      [issue.number]: {
        decision: changed ? r : old,
        applied: true,
        previous: changed ? old.priority : null,
        history: [...m[issue.number].history, { event: changed ? "rechecked_changed" : "rechecked_kept", priority: r.priority, at: now() }],
      },
    }));
    busy.current = false;
  }

  function reset() {
    if (busy.current) return;
    setMemory({}); setActivity({}); setRun(null); setOutput(null); setSelected(ISSUES[0].number);
  }

  const running = run && run.step < steps.length;
  const canRecheck = issue.activity && stored && !activity[issue.number];

  return (
    <div className="demo">
      <div className="inbox">
        <div className="panel-head">
          <span>Repository inbox</span>
          <span className="head-actions">
            <button className="link" onClick={triageAll} disabled={running}>Triage all</button>
            <button className="link" onClick={reset} disabled={running}>Reset</button>
          </span>
        </div>
        {ISSUES.map((i) => {
          const m = memory[i.number];
          return (
            <button key={i.number} className={`issue-row ${i.number === selected ? "active" : ""}`}
              onClick={() => !running && (setSelected(i.number), setOutput(null), setRun(null))}>
              <span className="issue-meta">{i.kind === "pull request" ? "PR" : "Issue"} #{i.number}</span>
              <span className="issue-title">{i.title}</span>
              <span className="labels">
                {m ? (m.applied ? toLabels(m.decision).map((l) => <Label key={l} name={l} />) : <span className="label l-human">needs human review</span>) : <span className="label l-none">untriaged</span>}
                {m?.previous && <span className="label l-changed">was {m.previous}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="detail">
        <div className="issue-card">
          <p className="issue-meta">{view.kind} #{view.number} · opened by @{view.author} · 👍 {view.reactions}</p>
          <h3>{view.title}</h3>
          <p>{view.body}</p>
          {view.comments.length > 0 && (
            <div className="comments">
              {view.comments.map((c) => <p key={c} className="comment new">💬 {c}</p>)}
            </div>
          )}
          <div className="actions">
            {!stored && <button className="btn primary" onClick={() => triage()} disabled={running}>▶ Run agent on this item</button>}
            {canRecheck && <button className="btn primary" onClick={newActivity} disabled={running}>⚡ Simulate new activity (+38 👍, new comments)</button>}
            {stored && !canRecheck && !running && <span className="muted small">Triaged.{issue.activity ? "" : " Try issue #102 to see self-correction."}</span>}
          </div>
        </div>

        <div className="pipeline">
          <p className="panel-head">{run?.mode === "recheck" ? "Re-check loop" : "Triage pipeline"}</p>
          <ol>
            {steps.map((s, idx) => {
              const state = !run || run.number !== issue.number ? "" : idx < run.step ? "done" : idx === run.step ? "now" : "";
              return (
                <li key={s.key + idx} className={state}>
                  <span className="dot">{state === "done" ? "✓" : idx + 1}</span>
                  <div><b>{s.title}</b><small>{s.text}</small></div>
                </li>
              );
            })}
          </ol>
        </div>

        {output && run?.number === issue.number && (
          <div className="result">
            {output.mode === "triage" ? (
              <p className="verdict">
                {output.applied
                  ? <>✅ Labels applied on GitHub</>
                  : <>✋ Confidence {output.decision.confidence} is below {THRESHOLD}: flagged for a human, nothing written</>}
              </p>
            ) : (
              <p className="verdict">
                {output.changed
                  ? <>🔁 Decision overturned: <span className={`pill pri-${output.previous.priority}`}>{output.previous.priority}</span> → <span className={`pill pri-${output.decision.priority}`}>{output.decision.priority}</span> (confidence {output.previous.confidence} → {output.decision.confidence}). Comment posted explaining why.</>
                  : <>Earlier decision kept.</>}
              </p>
            )}
            <div className="labels">{toLabels(output.decision).map((l) => <Label key={l} name={l} />)}</div>
            <p className="muted small">LLM output (validated):</p>
            <pre className="code">{JSON.stringify(output.decision, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="memory">
        <p className="panel-head">Memory store (SQLite) · what the dashboard shows</p>
        {Object.keys(memory).length === 0 ? (
          <p className="muted small">Empty. Run the agent on an issue to see its decision stored here.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Priority</th><th>Confidence</th><th>Applied</th><th>History</th><th>Reasoning</th></tr></thead>
              <tbody>
                {Object.entries(memory).map(([n, m]) => (
                  <tr key={n}>
                    <td>#{n}</td>
                    <td><span className={`pill pri-${m.decision.priority}`}>{m.decision.priority}</span></td>
                    <td>{m.decision.confidence}</td>
                    <td>{m.applied ? "yes" : "no (human)"}</td>
                    <td className="hist">{m.history.map((h) => `${h.event} ${h.at}`).join(" → ")}</td>
                    <td>{m.decision.reasoning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
