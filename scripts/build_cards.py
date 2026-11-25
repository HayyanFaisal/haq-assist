"""Build the frozen rights cards from data/cards_draft.json.

Every legal step must quote its section exactly; the quote is replaced by the exact source text
and the card gets the official PDF link (with page). Any quote not found -> the build fails.
Also writes data/reviewed.json: the sections the cards rely on (reviewed by Claude + Codex).
"""
import json
import sys
from pathlib import Path

import httpx
import truststore

truststore.inject_into_ssl()
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.verify import exact_quote, quote_page  # noqa: E402


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    S = {json.loads(l)["id"]: json.loads(l) for l in (ROOT / "data" / "sections.jsonl").open(encoding="utf-8")}
    cards = json.loads((ROOT / "data" / "cards_draft.json").read_text(encoding="utf-8"))
    global MAN
    MAN = {e["id"]: e for e in json.loads((ROOT / "data" / "manifest.json").read_text(encoding="utf-8"))}
    out_dir = ROOT / "data" / "cards"
    out_dir.mkdir(exist_ok=True)
    errors, reviewed = [], set()
    for c in cards:
        for st in c["steps"]:
            if st["kind"] != "law":
                continue
            s = S[st["source"]]
            pdf = str(ROOT / MAN[s["act_id"]]["file"])
            verified = []
            for raw in st.get("quotes") or [st["quote"]]:
                q = exact_quote(raw, s["text"])
                if not q:
                    errors.append(f"{c['id']}: quote not in {st['source']}: {raw[:60]}")
                    continue
                pg = quote_page(pdf, s["page"], q)
                verified.append({"text": q, "page": pg, "link": f"{s['source_url']}#page={pg}"})
            st.pop("quote", None)
            st.update(quotes=verified, act=s["act"], section=s["section"], section_title=s["title"],
                      link=verified[0]["link"] if verified else s["source_link"], version_date=s.get("version_date"),
                      applies_in=s["applies_in"])
            reviewed.add(st["source"])
        for link in c.get("links", []):
            try:
                link["checked_status"] = httpx.get(link["url"], timeout=15, follow_redirects=True,
                                                   headers={"User-Agent": "Mozilla/5.0"}).status_code
            except Exception as e:
                link["checked_status"] = f"unreachable: {type(e).__name__}"
        (out_dir / f"{c['id']}.json").write_text(json.dumps(c, ensure_ascii=False, indent=1), encoding="utf-8")
    if errors:
        print("BUILD FAILED:\n  " + "\n  ".join(errors))
        sys.exit(1)
    # Sections checked word-for-word by Claude and Codex (Phase 1 spot checks + card sources)
    reviewed |= {"ict_consumer:8", "ict_consumer:2", "punjab_consumer:28", "punjab_consumer:31", "peca:30", "crpc:167"}
    (ROOT / "data" / "reviewed.json").write_text(json.dumps(sorted(reviewed), indent=1), encoding="utf-8")
    print(f"built {len(cards)} cards; {len(reviewed)} reviewed sections;",
          {c['id']: [l.get('checked_status') for l in c.get('links', [])] for c in cards if c.get('links')})


if __name__ == "__main__":
    main()
