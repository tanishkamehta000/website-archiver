from urllib.parse import urlparse, urljoin, urldefrag

def normalize_url(base: str, maybe_relative: str) -> str:
    joined = urljoin(base, maybe_relative)
    clean, _ = urldefrag(joined)
    return clean

def same_host(u1: str, u2: str) -> bool:
    p1, p2 = urlparse(u1), urlparse(u2)
    return p1.scheme in ("http", "https") and p1.netloc == p2.netloc

def host_of(url: str) -> str:
    return urlparse(url).netloc.replace(":", "_")
