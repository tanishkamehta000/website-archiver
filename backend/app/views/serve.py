from fastapi import APIRouter
from pathlib import Path

SNAP_ROOT = Path(__file__).resolve().parents[2] / "snapshots"
router = APIRouter()