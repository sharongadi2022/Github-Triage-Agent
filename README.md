# GitHub Triage Agent

An autonomous agent that labels and prioritizes GitHub issues and pull requests using an LLM-driven rubric, and re-checks its past decisions to correct itself as new activity comes in.

**Live demo and project walkthrough:** [https://sharongadi2022.github.io/github-triage-agent/](https://sharongadi2022.github.io/Github-Triage-Agent/)

## How it works

```
GitHub (issues/PRs) -> Ingestion -> Agent core (rubric + LLM) -> Validator -> Apply labels
        ^                                 ^                                     |
        |                                 |                                     v
   new activity  ----------------->  Memory store (SQLite)  <----------  save decision
                                                                                |
                                                                   FastAPI -> React dashboard
```

1. **Ingestion** (`backend/app/github_client.py`): polls GitHub for open issues/PRs updated since the last run, skips bot comments, trims long text.
2. **Rubric + LLM** (`backend/app/rubric.py`, `agent.py`): a LangChain prompt holds the rubric (type, area, priority P0 to P3, clarity, impact, confidence). A local model on Ollama answers in JSON.
3. **Validation** (`backend/app/schemas.py`): Pydantic checks the output. Malformed answers are retried up to 3 times.
4. **Action**: if confidence is at least 0.6, labels are applied via the GitHub API. Otherwise the item is left for a human. `DRY_RUN=true` logs without writing.
5. **Memory** (`backend/app/memory.py`): each decision and its history is stored in SQLite.
6. **Self-correction**: when an issue gets new activity, the stored decision and the new comments go back to the LLM. It only overturns itself when the new confidence is at least 0.15 higher, which prevents flip-flopping, and it posts a comment explaining the change.

## Tech stack

Python · LangChain · Ollama · PyGithub · Pydantic · SQLite · FastAPI · React (Vite) · pytest

## Project structure

```
backend/
  app/
    config.py         settings from .env
    github_client.py  ingestion + action layer
    rubric.py         rubric prompts
    schemas.py        Pydantic models
    agent.py          triage + re-check logic
    memory.py         SQLite memory store
    run_agent.py      polling loop
    main.py           FastAPI for the dashboard
  tests/              unit + integration tests (fake LLM, fake GitHub)
frontend/             React + Vite explainer and demo
docs/                 built frontend, served by GitHub Pages
```

## Running it

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # set GITHUB_TOKEN and GITHUB_REPO
ollama pull llama3.1
python -m app.run_agent     # start the triage loop
uvicorn app.main:app        # optional: dashboard API on :8000
```

Tests:

```bash
cd backend
pytest
```

Frontend:

```bash
cd frontend
npm install
npm run dev      # local dev server
npm run build    # writes the site to ../docs
```

The demo on the site uses recorded agent outputs, so it runs in the browser without a backend.
