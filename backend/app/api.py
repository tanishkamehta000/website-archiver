import asyncio, time
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, AnyHttpUrl
from .crawler.crawl import Crawler
from .crawler.url_utils import host_of
from .storage.fs_store import load_index, delete_snapshot, delete_host, delete_all, list_sites  # added list_sites

router = APIRouter()

class ArchiveReq(BaseModel):
    url: AnyHttpUrl
    depth: int | None = 1
    max_pages: int | None = None

_jobs: Dict[str, Dict[str, Any]] = {}

def _job_id(host: str, ts: str) -> str:
    return f"{host}:{ts}"

async def _run_job(job_id: str, url: str, depth: int, ts: str, started_at: str, max_pages: int):
    def on_progress(pages: int, bytes_written: int, limit: int):
        pct = max(1, min(99, int(pages / max(1, limit) * 100)))
        job = _jobs.get(job_id)
        if job:
            job['progress'] = pct
            job['details'] = {'pages': pages, 'bytes': bytes_written, 'limit': limit}

    crawler = Crawler(url, ts, depth=depth, page_limit=max_pages, on_progress=on_progress)
    try:
        await crawler.crawl()
        crawler.finalize_index(started_at, status='success')
        _jobs[job_id]['status'] = 'success'
        _jobs[job_id]['progress'] = 100
        _jobs[job_id]['details'] = {
            'pages': crawler.count_fetched,
            'bytes': crawler.bytes_stored,
            'limit': crawler.page_limit
        }
    except Exception as e:
        crawler.finalize_index(started_at, status='error', error=str(e))
        _jobs[job_id]['status'] = 'error'
        _jobs[job_id]['error'] = str(e)

@router.post('/archive')
async def start_archive(req: ArchiveReq):
    host = host_of(str(req.url))
    ts = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
    job_id = _job_id(host, ts)
    started_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    max_pages = req.max_pages or 60
    _jobs[job_id] = {
        'status': 'running',
        'progress': 0,
        'host': host,
        'ts': ts,
        'url': str(req.url),
        'started_at': started_at,
        'details': {'pages': 0, 'bytes': 0, 'limit': max_pages}
    }
    asyncio.create_task(_run_job(job_id, str(req.url), req.depth or 1, ts, started_at, max_pages))
    return {'job_id': job_id}

@router.get('/archive/{job_id}/status')
async def job_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, 'job not found')
    return job

# Use disk for the sites list so it persists across restarts
@router.get('/sites')
async def sites():
    return list_sites()

@router.get('/site/{host}/snapshots')
async def host_snapshots(host: str):
    return load_index(host)

@router.delete('/site/{host}/{ts}')
async def delete_one_snapshot(host: str, ts: str):
    jid = f"{host}:{ts}"
    j = _jobs.get(jid)
    if j and j.get('status') == 'running':
        raise HTTPException(409, 'Cannot delete while capture is running')
    delete_snapshot(host, ts)
    _jobs.pop(jid, None)
    return {"deleted": True}

@router.delete('/site/{host}')
async def delete_host_snapshots(host: str):
    if any(v.get('host') == host and v.get('status') == 'running' for v in _jobs.values()):
        raise HTTPException(409, 'Cannot delete while a capture is running for this host')
    delete_host(host)
    for k in list(_jobs.keys()):
        if _jobs[k].get('host') == host:
            _jobs.pop(k, None)
    return {"deleted": True}

@router.delete('/sites')
async def delete_everything(confirm: str = Query(..., description="Must be ALL")):
    if confirm != "ALL":
        raise HTTPException(400, "Pass confirm=ALL to delete everything")
    if any(v.get('status') == 'running' for v in _jobs.values()):
        raise HTTPException(409, 'Cannot delete while any capture is running')
    delete_all()
    _jobs.clear()
    return {"deleted": True}