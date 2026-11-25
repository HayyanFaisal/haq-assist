"""Download the library's official PDFs and record provenance (triple check, step 1).

Federal and ICT acts are resolved through data/index/pakistancode_index.json
(built by pc_index.py). Provincial acts come from data/sources_provincial.json
once their URLs are confirmed. Only .gov.pk / .gob.pk hosts are accepted.

Writes PDFs to data/raw/<jurisdiction>/ and merges entries into data/manifest.json.
"""
import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
import truststore

truststore.inject_into_ssl()

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MANIFEST = DATA / "manifest.json"
OFFICIAL = re.compile(r"(^|\.)(gov\.pk|gob\.pk)$")

# (exact Pakistan Code title, jurisdiction tag, short id)
# "federal" = applies nationwide; "ict" = the Islamabad Capital Territory version or scope.
FEDERAL_ICT = [
    ("Constitution of the Islamic Republic of Pakistan", "federal", "constitution"),
    ("Pakistan Penal Code (PPC),1860 (Under Review)", "federal", "ppc"),
    ("Code of Criminal Procedure (CrPC), 1898 (Under Review)", "federal", "crpc"),
    ("Qanun-e-Shahadat Order, 1984 (QSO)", "federal", "qso"),
    ("Code of Civil Procedure (CPC) , 1908 (Under Review)", "federal", "cpc"),
    ("Contract Act, 1872", "federal", "contract_act"),
    ("Specific Relief Act, 1877", "federal", "specific_relief"),
    ("Succession Act, 1925", "federal", "succession_act"),
    ("Muslim Family Laws Ordinance, 1961", "federal", "mflo"),
    ("Dissolution of Muslim Marriages Act, 1939", "federal", "dmma"),
    ("The Family Courts Act, 1964", "federal", "family_courts"),
    ("Guardians and Wards Act, 1890", "federal", "guardians_wards"),
    ("Prevention of Electronic Crimes Act, 2016", "federal", "peca"),
    ("Anti-Rape (Investigation and Trial) Act, 2021", "federal", "anti_rape"),
    ("Juvenile Justice System Act, 2018", "federal", "juvenile_justice"),
    ("Torture and Custodial Death (Prevention and Punishment) Act, 2022", "federal", "torture_custodial"),
    ("Legal Aid and Justice Authority Act, 2020", "federal", "legal_aid"),
    ("Establishment of the Office of Wafaqi Mohtasib (Ombudsman) Order, 1983", "federal", "wafaqi_mohtasib"),
    ("Police Order, 2002", "ict", "police_order"),
    ("Provincial Motor Vehicles Ordinance, 1965", "ict", "mvo_1965"),
    ("Islamabad Rent Restriction Ordinance, 2001", "ict", "ict_rent"),
    ("Islamabad Consumers Protection Act, 1995", "ict", "ict_consumer"),
    ("Protection Against Harassment of Women at the Work Place Act, 2010", "ict", "workplace_harassment"),
    ("Domestic Violence (Prevention and Protection) Act, 2026", "ict", "domestic_violence"),
    ("Right of Access to Information Act, 2017", "ict", "rti"),
    ("Enforcement of Women's Property Rights Act, 2020", "ict", "women_property"),
    ("Islamabad Capital Territory Senior Citizens Act, 2021", "ict", "ict_senior_citizens"),
    ("Islamabad Capital Territory Domestic Workers Act, 2022", "ict", "ict_domestic_workers"),
    ("Islamabad Capital Territory Prohibition of Corporal Punishment Act, 2021", "ict", "ict_corporal_punishment"),
    ("Islamabad Capital Territory Child Marriage Restraint Act, 2025", "ict", "ict_child_marriage"),
    ("Limitation Act, 1908", "federal", "limitation_act"),  # added 2026-11-24: time limits for suits (e.g. land fraud)
]

PDF_LINK = re.compile(r'href="([^"]*pdffiles/[^"]+\.pdf)"', re.I)


def official(url: str) -> bool:
    return bool(OFFICIAL.search(urlparse(url).hostname or ""))


def load_manifest() -> dict:
    if MANIFEST.exists():
        return {e["id"]: e for e in json.loads(MANIFEST.read_text(encoding="utf-8"))}
    return {}


def save_manifest(entries: dict) -> None:
    rows = sorted(entries.values(), key=lambda e: (e["jurisdiction"], e["id"]))
    MANIFEST.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")


def download(client: httpx.Client, entry: dict) -> dict:
    if not official(entry["pdf_url"]):
        raise ValueError(f"refusing non-government host: {entry['pdf_url']}")
    r = client.get(entry["pdf_url"])
    r.raise_for_status()
    if not r.content.startswith(b"%PDF"):
        raise ValueError(f"not a PDF: {entry['pdf_url']}")
    path = DATA / "raw" / entry["jurisdiction"] / f"{entry['id']}.pdf"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(r.content)
    entry.update(
        file=str(path.relative_to(ROOT)).replace("\\", "/"),
        sha256=hashlib.sha256(r.content).hexdigest(),
        bytes=len(r.content),
        downloaded_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    return entry


def fetch_federal_ict(client: httpx.Client, entries: dict) -> None:
    index = {r["title"]: r["page_url"] for r in json.loads((DATA / "index" / "pakistancode_index.json").read_text(encoding="utf-8"))}
    for title, jur, act_id in FEDERAL_ICT:
        page_url = index.get(title)
        if not page_url:
            print(f"MISSING in index: {title}")
            continue
        page = client.get(page_url).text
        links = PDF_LINK.findall(page)
        if not links:
            print(f"NO PDF on page: {title}")
            continue
        entry = {"id": act_id, "title": title, "jurisdiction": jur, "source": "Pakistan Code",
                 "page_url": page_url, "pdf_url": urljoin(page_url, links[0])}
        try:
            entries[act_id] = download(client, entry)
            print(f"ok  {act_id:26s} {entries[act_id]['bytes']//1024:6d} KB")
        except Exception as e:  # keep going; report at the end
            print(f"ERR {act_id}: {e}")
        time.sleep(0.5)


def fetch_provincial(client: httpx.Client, entries: dict) -> None:
    src = DATA / "sources_provincial.json"
    if not src.exists():
        print("no data/sources_provincial.json yet")
        return
    only = set(sys.argv[2:])
    for s in json.loads(src.read_text(encoding="utf-8")):
        if only and s["id"] not in only:
            continue
        entry = {"id": s["id"], "title": s["act_title"], "jurisdiction": s["province"], "category": s["category"],
                 "source": urlparse(s["url"]).hostname, "page_url": s.get("page_url", s["url"]), "pdf_url": s["url"]}
        try:
            entries[s["id"]] = download(client, entry)
            print(f"ok  {s['id']:26s} {entries[s['id']]['bytes']//1024:6d} KB")
        except Exception as e:
            print(f"ERR {s['id']}: {e}")
        time.sleep(0.5)


def main() -> None:
    which = sys.argv[1] if len(sys.argv) > 1 else "federal"
    only = set(sys.argv[2:])  # optional act ids: fetch just these (e.g. acts added later)
    if only:
        global FEDERAL_ICT
        FEDERAL_ICT = [a for a in FEDERAL_ICT if a[2] in only]
    entries = load_manifest()
    with httpx.Client(headers={"User-Agent": "Mozilla/5.0 (HaqAssist research)"}, timeout=120, follow_redirects=True) as client:
        if which in ("federal", "all"):
            fetch_federal_ict(client, entries)
        if which in ("provincial", "all"):
            fetch_provincial(client, entries)
    save_manifest(entries)
    print(f"manifest: {len(entries)} acts")


if __name__ == "__main__":
    main()
