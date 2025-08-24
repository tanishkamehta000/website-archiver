# FastAPI wiring: CORS, API routes, and static snapshots
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import router as api_router
from .views.serve import router as serve_router, SNAP_ROOT

app = FastAPI(title="Website Archiver")

# vite calls API
# TODO: tighten "*"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
app.include_router(serve_router)

app.mount("/archive", StaticFiles(directory=SNAP_ROOT), name="archive")