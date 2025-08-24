# Website Archiver (React + FastAPI)

An end-to-end web archiving tool (Wayback-style). Enter a URL, crawl same-host pages, rewrite assets, and serve snapshots locally with version history. Includes a progress UI, one-click re-capture and delete, “All sites” overview, and an interactive Crawl Map.

## Features

- **Capture & Snapshot**
  - Input URL, choose depth and max pages.
  - Crawls only same host links, downloads assets, rewrites paths for snapshots locally.
  - Progress updates: pages fetched, bytes written, % toward max pages.

- **Versioning & Re-archiving**
  - Per-site snapshot history with timestamps.
  - Recapture (reload/update) button.
  - View any timestamp via in-app viewer.

- **Extra**
  - Crawl Map: interactive D3 force map of discovered pages/links per snapshot.
  - Delete: remove one snapshot, an entire site, or **ALL** snapshots.


## Tech Stack

- Frontend: React (Vite), TypeScript, D3 (map)
- Backend: FastAPI, Uvicorn, aiohttp, BeautifulSoup4, lxml, cssutils
- Storage: File system (no database). Find snapshots under `backend/snapshots/`.


## Project Start Up

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Go to http://localhost:5173/ and put in the website to crawl.
