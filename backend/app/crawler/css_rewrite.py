# rewriting css url for local archive paths
import re
from .url_utils import normalize_url, same_host
from typing import Tuple, List

_URL_RE = re.compile(r"url\\(([^)]+)\\)", re.IGNORECASE) # captures the inner token without quotes

def rewrite_css(root_url: str, css_text: str, to_local) -> Tuple[str, List[str]]:
    """Rewrite url(...) in CSS to local paths and return list of asset URLs to fetch."""
    assets: List[str] = []

    def repl(m):
        raw = m.group(1).strip().strip('"').strip("'")
        if not raw or raw.startswith("data:"): # ignore empty URIs
            return m.group(0)
        absu = normalize_url(root_url, raw)
        if same_host(root_url, absu):
            assets.append(absu)
            return f"url({to_local(absu)})"
        return m.group(0)

    rewritten = _URL_RE.sub(repl, css_text)
    # preserve order
    return rewritten, list(dict.fromkeys(assets))
