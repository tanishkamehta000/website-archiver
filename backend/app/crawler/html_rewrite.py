from bs4 import BeautifulSoup
from typing import Tuple, List
from .url_utils import normalize_url, same_host

def rewrite_html(root_url: str, html: str, to_local) -> Tuple[str, List[str], List[str]]:
    """
    Return (rewritten_html, page_links, asset_urls).
    Keeps it simple: rewrites <a href>, <img src>, <script src>, <link rel=stylesheet href>.
    """
    soup = BeautifulSoup(html, "lxml")
    links: List[str] = []
    assets: List[str] = []

    for a in soup.find_all("a"):
        href = a.get("href")
        if not href: 
            continue
        absu = normalize_url(root_url, href)
        if same_host(root_url, absu):
            links.append(absu)
            a["href"] = to_local(absu)

    def add_asset(tag, attr):
        val = tag.get(attr)
        if not val:
            return
        absu = normalize_url(root_url, val)
        if same_host(root_url, absu):
            assets.append(absu)
            tag[attr] = to_local(absu)

    for tag in soup.find_all(["img", "script"]):
        add_asset(tag, "src")

    for link in soup.find_all("link"):
        rels = set(link.get("rel") or [])
        if "stylesheet" in rels:
            href = link.get("href")
            if href:
                absu = normalize_url(root_url, href)
                if same_host(root_url, absu):
                    assets.append(absu)
                    link["href"] = to_local(absu)

    def dedup(seq: List[str]) -> List[str]:
        seen = set(); out = []
        for x in seq:
            if x not in seen:
                seen.add(x); out.append(x)
        return out

    return str(soup), dedup(links), dedup(assets)
