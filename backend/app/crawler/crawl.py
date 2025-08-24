# crawler for single host snapshot (BFS)
# tracks progress for getting HTML pages from host, rewrites to local paths, tracks simple link graph for map visualization

import asyncio, hashlib, time, os, json
from urllib.parse import urlparse
from typing import Set, Tuple
from aiohttp import ClientSession, ClientTimeout
from ..storage.fs_store import ensure_dirs, write_bytes, write_text, save_index, load_index
from .url_utils import normalize_url, same_host, host_of
from .html_rewrite import rewrite_html
from .css_rewrite import rewrite_css

# timeout
DEFAULT_TIMEOUT = ClientTimeout(total=20)

# static assests
_ASSET_EXTS = {
    ".png",".jpg",".jpeg",".gif",".webp",".svg",".ico",
    ".css",".js",".map",
    ".woff",".woff2",".ttf",".otf",
    ".mp4",".webm",".mp3",".wav",".ogg"
}

def _ext_from_url(url: str) -> str:
    path = urlparse(url).path
    _, ext = os.path.splitext(path)
    return ext.lower()

# short name
def choose_name(url: str, ext: str = "") -> str:
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]
    safe = url.replace("http://", "").replace("https://", "").replace("/", "_").replace("?", "_").replace(":", "_")
    return f"{safe[:60]}__{h}{ext}"

class Crawler:
    def __init__(self, root_url: str, ts: str, depth: int = 1, page_limit: int = 100, on_progress=None):
        self.root_url = root_url
        self.host = host_of(root_url)
        self.ts = ts
        self.depth = depth
        self.page_limit = page_limit

        # tracking
        self.seen_pages: Set[str] = set()
        self.bytes_stored = 0
        self.count_fetched = 0

        self.dir = ensure_dirs(self.host, self.ts)
        self.on_progress = on_progress
        
        self.graph_nodes: Set[str] = set()
        self.graph_edges: Set[Tuple[str, str]] = set()

    # absolute url to local path
    def local_path_for(self, url: str) -> str:
        ext = _ext_from_url(url)
        if ext in _ASSET_EXTS:
            return f"/archive/{self.host}/{self.ts}/local/{choose_name(url, ext)}"
        return f"/archive/{self.host}/{self.ts}/local/{choose_name(url, '.html')}"

    # get url and return metadata
    async def fetch(self, session: ClientSession, url: str) -> Tuple[bytes, str]:
        async with session.get(url) as resp:
            data = await resp.read()
            ctype = resp.headers.get('Content-Type', '')
            return data, ctype

    # BFS crawling
    async def crawl(self):
        queue: asyncio.Queue[Tuple[str,int]] = asyncio.Queue()
        await queue.put((self.root_url, 0))
        self.seen_pages.add(self.root_url)

        # limit parallel HTTP requests
        sem = asyncio.Semaphore(8)

        async with ClientSession(timeout=DEFAULT_TIMEOUT) as session:
            while not queue.empty() and self.count_fetched < self.page_limit:
                url, d = await queue.get()
                if d > self.depth:
                    continue

                # fetch with parallel request limit
                try:
                    async with sem:
                        data, ctype = await self.fetch(session, url)
                except Exception as e:
                    write_text(self.dir / 'original' / f"{choose_name(url, '.error.txt')}", f"{e}")
                    continue

                # update tracking
                self.count_fetched += 1
                self.bytes_stored += len(data)
                if self.on_progress:
                    try:
                        self.on_progress(self.count_fetched, self.bytes_stored, self.page_limit)
                    except Exception:
                        pass

                self.graph_nodes.add(url)

                if 'text/html' in ctype:
                    # save original html and locally written reversion
                    html = data.decode('utf-8', errors='ignore')
                    rewritten, links, assets = rewrite_html(url, html, self.local_path_for)
                    write_text(self.dir / 'original' / f"{choose_name(url, '.html')}", html)
                    write_text(self.dir / 'local' / f"{choose_name(url, '.html')}", rewritten)

                    # enqueue links for BFS
                    for l in links:
                        if same_host(self.root_url, l):
                            self.graph_nodes.add(l)
                            self.graph_edges.add((url, l))
                            if l not in self.seen_pages:
                                self.seen_pages.add(l)
                                await queue.put((l, d+1))

                    # get and store assets that are referenced in this page
                    for a in assets:
                        try:
                            async with sem:
                                adata, actype = await self.fetch(session, a)
                            aext = _ext_from_url(a)
                            if 'text/css' in actype or aext == '.css':
                                css_text = adata.decode('utf-8', errors='ignore')
                                rewritten_css, css_assets = rewrite_css(a, css_text, self.local_path_for)
                                write_text(self.dir / 'local' / f"{choose_name(a, '.css')}", rewritten_css)
                                self.bytes_stored += len(rewritten_css.encode('utf-8'))
                                if self.on_progress:
                                    try:
                                        self.on_progress(self.count_fetched, self.bytes_stored, self.page_limit)
                                    except Exception:
                                        pass
                                for ca in css_assets:
                                    try:
                                        async with sem:
                                            cadata, _ = await self.fetch(session, ca)
                                        caext = _ext_from_url(ca)
                                        write_bytes(self.dir / 'local' / f"{choose_name(ca, caext if caext in _ASSET_EXTS else '')}", cadata)
                                        self.bytes_stored += len(cadata)
                                    except Exception:
                                        pass
                            # non css (store as is)
                            else:
                                write_bytes(self.dir / 'local' / f"{choose_name(a, aext if aext in _ASSET_EXTS else '')}", adata)
                                self.bytes_stored += len(adata)
                        # ignore individual assest failures and continue
                        except Exception:
                            pass
                # non HTML root
                else:
                    aext = _ext_from_url(url)
                    write_bytes(self.dir / 'local' / f"{choose_name(url, aext if aext in _ASSET_EXTS else '')}", data)

        landing = f"""
        <html><head><meta charset='utf-8'><title>Archived {self.root_url}</title></head>
        <body>
          <h3>Archived root: {self.root_url}</h3>
          <ul>
            <li><a href="{self.local_path_for(self.root_url)}">Open archived root page</a></li>
          </ul>
        </body></html>
        """
        write_text(self.dir / 'local' / 'index.html', landing)

        # persist graph
        graph = {
            "nodes": [{"id": u} for u in sorted(self.graph_nodes)],
            "edges": [{"source": s, "target": t} for (s, t) in sorted(self.graph_edges)]
        }
        write_text(self.dir / 'graph.json', json.dumps(graph, indent=2))

    # add capture entry to host index.json
    def finalize_index(self, started_at: str, status: str = 'success', error: str | None = None):
        idx = load_index(self.host)
        entry = {
            'host': self.host,
            'started_at': started_at,
            'finished_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'root_url': self.root_url,
            'depth': self.depth,
            'count_fetched': self.count_fetched,
            'bytes_stored': self.bytes_stored,
            'status': status,
            'error': error,
            'ts': self.ts,
        }
        idx.insert(0, entry)
        save_index(self.host, idx)
