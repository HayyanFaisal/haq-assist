"""Build an index of every act on Pakistan Code (pakistancode.gov.pk).

Crawls the alphabetical listing (A-Z, all pages) and writes
data/index/pakistancode_index.json as [{title, page_url}].
"""
import html
import json
import re
import time
from pathlib import Path

import httpx
import truststore

truststore.inject_into_ssl()  # use the Windows store: some .gov.pk servers omit intermediate certs

BASE = "https://pakistancode.gov.pk/english/"
OUT = Path(__file__).resolve().parents[1] / "data" / "index" / "pakistancode_index.json"
LINK = re.compile(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', re.S)
ACT_HREF = re.compile(r"^UY2FqaJw1-")  # act detail pages share this prefix


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def main() -> None:
    acts: dict[str, str] = {}
    with httpx.Client(headers={"User-Agent": "Mozilla/5.0"}, timeout=40, follow_redirects=True) as client:
        for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
            page = 1
            while page <= 40:
                url = f"{BASE}LGu0xAD?alp={letter}&page={page}&action=inactive"
                text = client.get(url).text
                found = 0
                for href, label in LINK.findall(text):
                    if ACT_HREF.match(href):
                        title = clean(label)
                        if title and href not in acts.values():
                            acts[title] = href
                            found += 1
                if found == 0:
                    break
                page += 1
                time.sleep(0.3)
            print(f"{letter}: {len(acts)} total")
    rows = [{"title": t, "page_url": BASE + h} for t, h in sorted(acts.items())]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {len(rows)} acts to {OUT}")


if __name__ == "__main__":
    main()
