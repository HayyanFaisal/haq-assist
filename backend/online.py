"""Online fallback: search official Pakistani government websites when the library can't answer.

Priority: P1 official law portals > P2 other .gov.pk / .gob.pk (courts, NCCIA, police, ministries).
Other sites are never used as sources. Fetched pages are untrusted data: they only become
numbered sources for the answer step, and every quote is still verified against their text.

Hardening (from the Codex security audit): HTTPS only; no userinfo or unusual ports; every
redirect hop re-checked against the allowlist before connecting; DNS resolved first and private /
loopback / link-local addresses refused; responses streamed with a hard byte cap; an overall
deadline; extracted text capped; a minimum relevance score for passages.
"""
from __future__ import annotations

import io
import ipaddress
import re
import socket
import time
from urllib.parse import urljoin, urlparse

import httpx
import truststore

truststore.inject_into_ssl()

P1 = ("pakistancode.gov.pk", "punjabcode.punjab.gov.pk", "sindhlaws.gov.pk", "kpcode.kp.gov.pk", "balochistancode.gob.pk",
      "na.gov.pk", "senate.gov.pk", "pap.gov.pk", "pas.gov.pk", "pakp.gov.pk", "pabalochistan.gov.pk")
OFFICIAL = re.compile(r"(^|\.)(gov\.pk|gob\.pk)$")
MAX_BYTES, TIMEOUT, MAX_PAGES, MAX_REDIRECTS = 4_000_000, 12, 4, 3
MAX_TEXT = 3_000_000            # characters of extracted text kept per document
DEADLINE = 75                   # seconds for the whole online step
MIN_SCORE = 0.05                # reranker relevance probability below this is not used as evidence
HEADERS = {"User-Agent": "Mozilla/5.0 (HaqAssist research prototype)"}
BACKENDS = ("google", "yandex", "auto")  # tested 2026-11-24: duckduckgo/bing/brave returned nothing to scripts


def priority(host: str) -> int:
    if any(host == d or host.endswith("." + d) for d in P1):
        return 1
    return 2 if OFFICIAL.search(host) else 9


def _public_host(host: str) -> bool:
    """The name must resolve only to public addresses (no SSRF to this machine or the LAN)."""
    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
    except OSError:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True


def allowed_url(url: str) -> bool:
    u = urlparse(url)
    host = (u.hostname or "").lower()
    return (u.scheme == "https" and not u.username and not u.password and u.port in (None, 443)
            and priority(host) <= 2 and _public_host(host))


def safe_get(url: str, max_bytes: int = MAX_BYTES, deadline: float | None = None) -> tuple[bytes, str] | None:
    """GET with every redirect hop checked before connecting, and a streamed byte cap."""
    with httpx.Client(headers=HEADERS, timeout=TIMEOUT, follow_redirects=False) as c:
        for _ in range(MAX_REDIRECTS + 1):
            if not allowed_url(url) or (deadline and time.time() > deadline):
                return None
            with c.stream("GET", url) as r:
                if r.status_code in (301, 302, 303, 307, 308) and r.headers.get("location"):
                    url = urljoin(url, r.headers["location"])
                    continue
                if r.status_code != 200:
                    return None
                if int(r.headers.get("content-length") or 0) > max_bytes:
                    return None
                buf = bytearray()
                for chunk in r.iter_bytes():
                    buf += chunk
                    if len(buf) > max_bytes or (deadline and time.time() > deadline):
                        return None
                return bytes(buf), url
    return None


def _search(query: str, max_results: int = 8, region: str | None = None) -> list[dict]:
    from ddgs import DDGS
    hits = []
    for backend in BACKENDS:
        for site in (("site:gov.pk", "site:gob.pk") if region == "balochistan" else ("site:gov.pk",)):
            try:
                hits += DDGS().text(f"{query} Pakistan {site}", max_results=max_results, backend=backend) or []
            except Exception:
                continue
        if any(priority((urlparse(h.get("href") or "").hostname or "").lower()) <= 2 for h in hits):
            break
    out, seen = [], set()
    for h in hits:
        url = h.get("href") or h.get("url") or ""
        host = (urlparse(url).hostname or "").lower()
        if url and url not in seen and priority(host) <= 2:
            seen.add(url)
            out.append({"url": url, "title": h.get("title", ""), "priority": priority(host)})
    return sorted(out, key=lambda h: h["priority"])


def _fetch(url: str, max_bytes: int = MAX_BYTES, deadline: float | None = None) -> tuple[str, str] | None:
    try:
        got = safe_get(url, max_bytes, deadline)
        if not got:
            return None
        data, final = got
        if data[:4] == b"%PDF":
            import pymupdf
            doc = pymupdf.open(stream=io.BytesIO(data), filetype="pdf")
            parts, n = [], 0
            for p in doc:  # stop extracting once the text cap is reached
                t = p.get_text()
                parts.append(t)
                n += len(t)
                if n > MAX_TEXT or (deadline and time.time() > deadline):
                    break
            return " ".join(parts)[:MAX_TEXT], final
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(data[:MAX_BYTES].decode("utf-8", "ignore"), "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "form"]):
            tag.decompose()
        return soup.get_text(" ")[:MAX_TEXT], final
    except Exception:
        return None


def _windows(text: str, size: int = 1200, overlap: int = 200) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    return [text[i:i + size] for i in range(0, max(1, len(text) - overlap), size - overlap)]


_TITLES: dict = {}


def pakistan_code_candidates(query: str, n: int = 2) -> list[dict]:
    """Search-engine-free route: match the question to the titles of all ~1,036 acts on Pakistan Code
    (data/index/pakistancode_index.json) and return their official pages (P1)."""
    import json
    from pathlib import Path

    import numpy as np
    from .app_state import engine
    eng = engine()
    dense = next(iter(eng.dense.values()))
    if not _TITLES:
        rows = json.loads((Path(__file__).resolve().parents[1] / "data" / "index" / "pakistancode_index.json").read_text(encoding="utf-8"))
        _TITLES["rows"] = rows
        cache = Path(__file__).resolve().parents[1] / "models" / "index" / f"titles__{len(rows)}.npy"
        if cache.exists():
            _TITLES["emb"] = np.load(cache)
        else:
            _TITLES["emb"] = dense.model.encode([r["title"] for r in rows], normalize_embeddings=True, convert_to_numpy=True)
            np.save(cache, _TITLES["emb"])
    kw = {"prompt_name": dense.cfg["query_prompt"]} if dense.cfg["query_prompt"] else {}
    q = dense.model.encode([query], normalize_embeddings=True, convert_to_numpy=True, **kw)[0]
    sims = _TITLES["emb"] @ q
    return [{"url": _TITLES["rows"][int(i)]["page_url"], "title": _TITLES["rows"][int(i)]["title"], "priority": 1,
             "title_sim": float(sims[i])} for i in np.argsort(-sims)[:n]]


def _pakistan_code_pdf(page_url: str, deadline: float) -> str | None:
    """Pakistan Code act pages link one official PDF; return its URL (checked like any other URL)."""
    got = safe_get(page_url, 1_000_000, deadline)
    if not got:
        return None
    m = re.search(rb'href="([^"]*pdffiles/[^"]+\.pdf)"', got[0], re.I)
    if m:
        url = urljoin(got[1], m.group(1).decode("ascii", "ignore"))
        return url if allowed_url(url) else None
    return None


def search_official(query: str, region: str | None, k: int = 4) -> list[dict]:
    """Up to k relevant passages from official sites (law portals first), within an overall deadline."""
    deadline = time.time() + DEADLINE
    pages = []
    for h in _search(query, region=region)[:MAX_PAGES * 2]:
        got = _fetch(h["url"], deadline=deadline)
        if got and len(got[0]) > 400:
            pages.append({**h, "text": got[0], "final_url": got[1]})
        if len(pages) >= MAX_PAGES or time.time() > deadline:
            break
    if len(pages) < 2 and time.time() < deadline:  # search engines blocked or thin: go to Pakistan Code directly
        for c in pakistan_code_candidates(query):
            pdf = _pakistan_code_pdf(c["url"], deadline)
            got = _fetch(pdf, max_bytes=20_000_000, deadline=deadline) if pdf else None
            if got and len(got[0]) > 400:
                pages.append({**c, "text": got[0], "final_url": got[1]})
    if not pages:
        return []
    qwords = set(re.findall(r"[a-z]{3,}", query.lower()))
    allp = [(p, w) for p in pages for w in _windows(p["text"])]
    # cheap pre-selection over whole documents (big acts have hundreds of passages), then rerank
    allp.sort(key=lambda pw: -len(qwords & set(re.findall(r"[a-z]{3,}", pw[1].lower()))))
    passages = allp[:60]
    try:
        from .app_state import reranker
        scores = list(reranker().scores(query, [w for _, w in passages]))
    except Exception:
        return []  # no relevance model -> no online evidence (fail closed)
    ranked = sorted(zip(scores, passages), key=lambda x: (-x[0], x[1][0]["priority"]))
    out, used = [], set()
    for score, (p, w) in ranked:
        if score < MIN_SCORE:
            break
        if (p["final_url"], w[:80]) in used:
            continue
        used.add((p["final_url"], w[:80]))
        host = (urlparse(p["final_url"]).hostname or "").lower()  # provenance from the final URL, not the search result
        prio = priority(host)
        kind = "official law portal" if prio == 1 else "government web page (not a law text)"
        out.append({"origin": "online", "id": p["final_url"], "act": p["title"] or host, "section": "", "title": "",
                    "text": w, "score": round(float(score), 3), "link": p["final_url"], "page": None, "version_date": None,
                    "level": kind, "applies_in": [], "domain": host,
                    "scope_note": f"Fetched live from {host} ({kind}). Not reviewed by Haq Assist; jurisdiction and version not verified."})
        if len(out) == k:
            break
    return out
