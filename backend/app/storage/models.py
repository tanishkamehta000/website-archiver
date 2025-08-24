from dataclasses import dataclass
from typing import Optional

@dataclass
class SnapshotInfo:
    host: str
    started_at: str
    finished_at: Optional[str]
    root_url: str
    depth: int
    count_fetched: int
    bytes_stored: int
    status: str  # running, success, error
    error: Optional[str] = None
