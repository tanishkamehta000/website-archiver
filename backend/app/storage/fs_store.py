import json
import shutil
from pathlib import Path
from typing import Dict, Any, List

ROOT = Path(__file__).resolve().parents[2] / "snapshots"

def host_dir(host: str) -> Path:
    return ROOT / host

def ts_dir(host: str, ts: str) -> Path:
    return host_dir(host) / ts

def ensure_dirs(host: str, ts: str) -> Path:
    d = ts_dir(host, ts)
    d.mkdir(parents=True, exist_ok=True)
    (d / "original").mkdir(exist_ok=True)
    (d / "local").mkdir(exist_ok=True)
    return d

def write_bytes(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True
    )
    path.write_bytes(data)

def write_text(path: Path, data: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(data, encoding="utf-8")

def load_index(host: str) -> List[Dict[str, Any]]:
    idx = host_dir(host) / "index.json"
    if not idx.exists():
        return []
    return json.loads(idx.read_text())

def save_index(host: str, entries: List[Dict[str, Any]]):
    hdir = host_dir(host)
    hdir.mkdir(parents=True, exist_ok=True)
    (hdir / "index.json").write_text(json.dumps(entries, indent=2))

def delete_snapshot(host: str, ts: str) -> bool:
    d = ts_dir(host, ts)
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)
    idx = load_index(host)
    new_idx = [e for e in idx if e.get("ts") != ts]
    save_index(host, new_idx)
    if not list(host_dir(host).glob("*")):
        shutil.rmtree(host_dir(host), ignore_errors=True)
    return True

def delete_host(host: str) -> bool:
    h = host_dir(host)
    if h.exists():
        shutil.rmtree(h, ignore_errors=True)
    return True

def delete_all() -> bool:
    if ROOT.exists():
        for child in ROOT.iterdir():
            shutil.rmtree(child, ignore_errors=True)
    ROOT.mkdir(parents=True, exist_ok=True)
    return True

def list_sites() -> List[Dict[str, Any]]:
    sites: List[Dict[str, Any]] = []
    if not ROOT.exists():
        return sites
    for d in ROOT.iterdir():
        if not d.is_dir():
            continue
        idx_file = d / "index.json"
        snapshots = 0
        last_ts = None
        last_started = None
        if idx_file.exists():
            try:
                entries = json.loads(idx_file.read_text())
                snapshots = len(entries)
                if entries:
                    last_ts = entries[0].get("ts")
                    last_started = entries[0].get("started_at")
            except Exception:
                pass
        sites.append({
            "host": d.name,
            "snapshots": snapshots,
            "last_ts": last_ts,
            "last_started": last_started
        })
    sites.sort(key=lambda x: (x["last_started"] or ""), reverse=True)
    return sites