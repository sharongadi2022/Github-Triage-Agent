"""Settings loaded from environment variables (see .env.example)."""
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    github_token: str = os.getenv("GITHUB_TOKEN", "")
    github_repo: str = os.getenv("GITHUB_REPO", "")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.1")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    poll_interval: int = int(os.getenv("POLL_INTERVAL", "300"))
    confidence_threshold: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.6"))
    overturn_margin: float = float(os.getenv("OVERTURN_MARGIN", "0.15"))
    dry_run: bool = os.getenv("DRY_RUN", "true").lower() == "true"
    db_path: str = os.getenv("DB_PATH", "triage_memory.db")


settings = Settings()
