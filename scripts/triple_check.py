"""Triple-check report for the statute library.

Check 1  Provenance: official .gov.pk/.gob.pk host, real PDF, SHA-256 matches the file,
         and the act's title appears on the PDF's first pages.
Check 2  Completeness: from split_report.json (contents list vs parsed sections).
Check 3a Cross-copy: for federal acts also present in the older independent scrape
         (HF AyeshaJadoon/Pakistan_Laws_Dataset), the share of each section's text found
         in that copy. Low overlap = amended since that scrape, or a parsing problem.
Check 3b Independent review: Codex audits a sample (see data/checks/codex_sample.jsonl).

Usage: triple_check.py [path to HF pdf_data.json]
Writes data/checks/triple_check.json and data/checks/triple_check.md.
"""
import hashlib
import json
import random
import re
import sys
from pathlib import Path
from statistics import median
from urllib.parse import urlparse

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CHECKS = DATA / "checks"
OFFICIAL = re.compile(r"(^|\.)(gov\.pk|gob\.pk)$")
STOP = {"the", "and", "of", "act", "ordinance", "order", "for", "to", "in", "at", "on", "a", "an", "code"}

# Sections the demo and reviewed records depend on: always in the Codex sample.
DEMO_CRITICAL = [
    "constitution:10", "constitution:9", "constitution:14", "crpc:61", "crpc:154", "crpc:22A", "crpc:54",
    "police_order:156", "ict_consumer:8", "ict_consumer:2", "peca:29", "peca:24", "ict_rent:5",
    "mvo_1965:116A", "punjab_consumer:28", "punjab_consumer:31", "workplace_harassment:8",
]


def words(s: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", s.lower())


def shingles(s: str, k: int = 30, step: int = 3) -> set[str]:
    """Letter-sequence shingles with all spacing removed: the older scrape splits words
    ("sec tion", "tr ade"), which must not count as a difference. The reference copy
    must use step=1 so every offset of the section's shingles can be found."""
    t = re.sub(r"[^a-z0-9]", "", s.lower())
    return {t[i:i + k] for i in range(0, max(len(t) - k + 1, 0), step)}


def provenance(entry: dict) -> dict:
    path = ROOT / entry["file"]
    data = path.read_bytes()
    doc = pymupdf.open(path)
    first = " ".join(doc[i].get_text() for i in range(min(3, len(doc)))).lower()
    first = re.sub(r"\s+", " ", first)
    key = [w for w in words(re.sub(r"\(.*?\)", "", entry["title"])) if w not in STOP and not w.isdigit()]
    hits = sum(1 for w in key if w in first)
    return {
        "official_host": bool(OFFICIAL.search(urlparse(entry["pdf_url"]).hostname or "")),
        "is_pdf": data.startswith(b"%PDF"),
        "sha256_ok": hashlib.sha256(data).hexdigest() == entry["sha256"],
        "title_on_first_pages": round(hits / len(key), 2) if key else None,
        "pages": len(doc),
    }


def load_hf(path: Path) -> dict[str, str]:
    """Map our act ids to the text of the same act in the older scrape (federal acts only)."""
    if not path.exists():
        return {}
    titles = {
        "constitution": r"CONSTITUTION OF THE ISLAMIC REPUBLIC", "ppc": r"PAKISTAN PENAL CODE",
        "qso": r"QANUN.E.SHAHADAT", "peca": r"PREVENTION OF ELECTRONIC CRI\s*MES",
        "workplace_harassment": r"HARASSMENT OF WOMEN AT THE WORK", "ict_rent": r"ISLAMABAD RENT RESTRICTION",
        "ict_consumer": r"ISLAMABAD CONSUMERS PROTECTION", "contract_act": r"^\s*THE CONTRACT ACT",
        "specific_relief": r"SPECIFIC RELIEF ACT", "mflo": r"MUSLIM FAMILY LAWS", "legal_aid": r"LEGAL AID AND JUSTICE",
        "guardians_wards": r"GUARDIANS AND WARDS", "succession_act": r"^\s*THE SUCCESSION ACT",
        "juvenile_justice": r"JUVENILE JUSTICE SYSTEM", "family_courts": r"FAMILY COURTS ACT",
        "dmma": r"DISSOLUTION OF MUSLIM MARRIAGES", "anti_rape": r"ANTI.RAPE",
        "torture_custodial": r"TORTURE AND CUSTODIAL", "rti": r"RIGHT OF ACCESS TO INFORMATION",
        "ict_senior_citizens": r"SENIOR CITIZENS ACT", "ict_domestic_workers": r"DOMESTIC WORKERS ACT",
        "women_property": r"WOMEN.S PROPERTY RIGHTS",
    }
    out = {}
    for rec in json.loads(path.read_text(encoding="utf-8")):
        head = re.sub(r"\s+", " ", (rec.get("text") or "")[:400]).upper()
        head = re.sub(r"^\s*PAGE \d+ OF \d+ ", "", head)
        for act_id, pat in titles.items():
            if act_id not in out and re.search(pat, head[:160]):
                out[act_id] = rec["text"]
    return out


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    hf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("missing")
    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    split = {r["id"]: r for r in json.loads((CHECKS / "split_report.json").read_text(encoding="utf-8"))}
    sections = [json.loads(l) for l in (DATA / "sections.jsonl").open(encoding="utf-8")]
    by_act: dict[str, list[dict]] = {}
    for s in sections:
        by_act.setdefault(s["act_id"], []).append(s)
    hf = load_hf(hf_path)

    rows = []
    for e in manifest:
        sp = split.get(e["id"], {})
        prov = provenance(e)
        cross = None
        if e["id"] in hf:
            ref = shingles(hf[e["id"]], step=1)
            scores = [len(sh & ref) / len(sh) for s in by_act.get(e["id"], []) if (sh := shingles(s["text"])) and s["section"] != "Schedules"]
            if scores:
                cross = {"median_overlap": round(median(scores), 3),
                         "sections_below_0.6": sum(1 for x in scores if x < 0.6), "sections": len(scores)}
        comp = sp.get("completeness", 0.0)
        status = ("complete" if comp >= 0.98 else "usable" if comp >= 0.85 else "partial") if sp.get("toc_entries") else "no contents list"
        ok1 = prov["official_host"] and prov["is_pdf"] and prov["sha256_ok"] and (prov["title_on_first_pages"] or 0) >= 0.6
        rows.append({
            "id": e["id"], "title": e["title"], "jurisdiction": e["jurisdiction"], "source_host": urlparse(e["pdf_url"]).hostname,
            "check1_provenance": "pass" if ok1 else "REVIEW", **prov,
            "check2_completeness": status, "toc_entries": sp.get("toc_entries"), "found": sp.get("found"),
            "missing": sp.get("missing", []), "parse_mode": sp.get("mode"), "updated_till": sp.get("updated_till"),
            "extent_clause": sp.get("extent_clause"), "check3a_cross_copy": cross,
        })
    (CHECKS / "triple_check.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")

    # Codex sample: all demo-critical sections + a stratified random sample (fixed seed).
    ids = {s["id"]: s for s in sections}
    sample = [ids[i] for i in DEMO_CRITICAL if i in ids]
    rnd = random.Random(20261124)
    for act_id, secs in sorted(by_act.items()):
        pool = [s for s in secs if s["id"] not in {x["id"] for x in sample} and s["section"] != "Schedules"]
        sample += rnd.sample(pool, min(1 if len(pool) < 40 else 2, len(pool)))
    man = {e["id"]: e for e in manifest}
    with (CHECKS / "codex_sample.jsonl").open("w", encoding="utf-8") as f:
        for s in sample:
            f.write(json.dumps({"id": s["id"], "act": s["act"], "level": s["level"], "applies_in": s["applies_in"], "section": s["section"],
                                "title": s["title"], "local_pdf": man[s["act_id"]]["file"], "source_url": s["source_url"],
                                "our_text": s["text"][:1500]}, ensure_ascii=False) + "\n")

    # Markdown summary
    n = len(rows)
    lines = [
        "# Triple-check report", "",
        f"Acts: {n}. Sections: {len(sections)}. Generated by scripts/triple_check.py.", "",
        "| Check | Result |", "|---|---|",
        f"| 1. Provenance (official host, real PDF, hash, title on first pages) | {sum(r['check1_provenance'] == 'pass' for r in rows)}/{n} pass |",
        f"| 2. Completeness | complete {sum(r['check2_completeness'] == 'complete' for r in rows)}, usable {sum(r['check2_completeness'] == 'usable' for r in rows)}, "
        f"partial {sum(r['check2_completeness'] == 'partial' for r in rows)}, no contents list {sum(r['check2_completeness'] == 'no contents list' for r in rows)} |",
        f"| 3a. Cross-copy vs older scrape | {sum(1 for r in rows if r['check3a_cross_copy'])} federal acts compared |",
        f"| 3b. Independent review (Codex) | {len(sample)} sections sampled, see codex_review.md |", "",
        "| Act | Jurisdiction | Host | 1 | 2 | Sections | 3a median overlap (low sections) | Updated till |", "|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        c = r["check3a_cross_copy"]
        c3 = f"{c['median_overlap']:.2f} ({c['sections_below_0.6']})" if c else "—"
        lines.append(f"| {r['id']} | {r['jurisdiction']} | {r['source_host']} | {r['check1_provenance']} | {r['check2_completeness']} | "
                     f"{r['found']}/{r['toc_entries'] or '?'} | {c3} | {r['updated_till'] or '—'} |")
    lines += ["", "## Missing sections (covered by the online fallback until fixed)", ""]
    lines += [f"- **{r['id']}**: {', '.join(r['missing'])}" for r in rows if r["missing"]]
    (CHECKS / "triple_check.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines[:9]))
    print("REVIEW provenance:", [r["id"] for r in rows if r["check1_provenance"] != "pass"])
    print("cross-copy low:", [(r["id"], r["check3a_cross_copy"]) for r in rows if r["check3a_cross_copy"] and r["check3a_cross_copy"]["median_overlap"] < 0.8])


if __name__ == "__main__":
    main()
