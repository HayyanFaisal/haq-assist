"""Ablation on the 57-prompt test set: what does each layer of Haq Assist buy?

A  LLM alone      - Gemma answers from memory and must cite act, section and an exact quote.
B  LLM + search   - the same retrieval as the app, the same answer prompt, but NO checks.
C  Full system    - Haq Assist: retrieval + exact-quote, number, jurisdiction and support checks,
                    verified summary, honest "Not found" (library only, online fallback off).
Online fallback is measured separately on the off-library prompts (C with online on).

Citation validity: the quote appears word-for-word in the cited official section.
Writes eval/results/ablation.{json,md}.
"""
import os
import sys

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "GPU-dcd92a54-ad5d-60fe-692f-264c71b64b3c")
os.environ.setdefault("HF_HOME", os.path.join(os.path.dirname(__file__), "..", "models", "hf"))

import json
import re
import statistics
import time
from pathlib import Path

from rapidfuzz import fuzz, process

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend import llm  # noqa: E402
from backend.app_state import engine  # noqa: E402
from backend.verify import exact_quote  # noqa: E402

RESULTS = ROOT / "eval" / "results"
A_SCHEMA = {"type": "object", "properties": {
    "answerable": {"type": "boolean"}, "answer": {"type": "string"},
    "citations": {"type": "array", "items": {"type": "object", "properties": {
        "act": {"type": "string"}, "section": {"type": "string"}, "quote": {"type": "string"}},
        "required": ["act", "section", "quote"]}}},
    "required": ["answerable", "answer", "citations"]}
A_SYS = ("You are a Pakistani legal assistant. Answer the question from your own knowledge of Pakistani law for the "
         "given region. Cite the act, the section or article number, and an exact quote of the statutory text for every "
         "claim. If you do not know, set answerable=false.")


def resolve(eng, act: str, section: str) -> str | None:
    """Map a model-cited act + section to a library section id (None if it doesn't exist in the official texts)."""
    acts = {s["act_id"]: s["act"] for s in eng.sections.values()}
    m = process.extractOne(act, acts, scorer=fuzz.token_set_ratio)
    if not m or m[1] < 80:
        return None
    num = re.sub(r"^(section|sec\.?|article|art\.?|s\.)\s*", "", section.strip(), flags=re.I)
    num = re.match(r"(\d+[A-Z]?(?:-[A-Z])?)", num.upper())
    if not num:
        return None
    sid = f"{m[2]}:{num.group(1)}"
    return sid if sid in eng.sections else None


def run_a(eng, t) -> dict:
    out = json.loads(llm.chat([{"role": "system", "content": A_SYS},
                               {"role": "user", "content": f"Region: {t['region']}\nQuestion: {t['query']}"}], A_SCHEMA, 900))
    cites = []
    for c in out.get("citations", []) if out.get("answerable") else []:
        sid = resolve(eng, c["act"], c["section"])
        valid = bool(sid and exact_quote(c["quote"], eng.sections[sid]["text"]))
        cites.append({"sid": sid, "valid": valid, "act": c["act"], "section": c["section"]})
    return {"answered": bool(out.get("answerable")) and bool(out.get("answer")), "citations": cites}


def run_b(eng, t) -> dict:
    und = llm.understand(t["query"])
    region = t["region"] if t["region"] != "unknown" else None
    sources = eng.search(t["query"], und, region)  # the same retrieval as the app
    draft = eng.compose(t["query"], sources) if sources else {"answerable": False, "steps": []}
    cites = []
    for st in draft.get("steps", []) if draft.get("answerable") else []:
        m = re.match(r"S?(\d+)", st.get("source", ""), re.I)
        i = int(m.group(1)) - 1 if m else -1
        src = sources[i] if 0 <= i < len(sources) else None
        valid = bool(src and exact_quote(st["quote"], src["text"]))
        cites.append({"sid": src["id"] if src else None, "valid": valid})
    return {"answered": bool(draft.get("answerable")) and bool(cites), "citations": cites}


def run_c(eng, t, online=False) -> dict:
    region = t["region"] if t["region"] != "unknown" else None
    r = eng.ask(t["query"], region, online)
    if r["status"] == "clarify":
        return {"answered": False, "clarified": True, "citations": [], "level": None}
    cites = []
    for st in r.get("steps", []):
        src = next(s for s in r["sources"] if s["ref"] == st["ref"])
        text = eng.sections[src["id"]]["text"] if src.get("origin") == "library" else None
        valid = bool(exact_quote(st["quote"], text)) if text else True  # online quotes were verified against the fetched page
        cites.append({"sid": src["id"], "valid": valid})
    return {"answered": r["status"] == "answered", "citations": cites, "level": r.get("level"),
            "dropped": len((r.get("checks") or {}).get("dropped", []))}


def score(name: str, rows: list[dict], tests: list[dict]) -> dict:
    by = {r["id"]: r for r in rows}
    ans = [t for t in tests if t["expect"] in ("answer", "clarify")]
    uns = [t for t in tests if t["expect"] in ("abstain", "online")]
    shown = [c for t in tests for c in by[t["id"]]["citations"]]
    valid = sum(c["valid"] for c in shown)
    gold_hit = sum(1 for t in ans if any(c["valid"] and c["sid"] in set(t["gold"]) for c in by[t["id"]]["citations"]))
    answered_ok = sum(1 for t in ans if by[t["id"]]["answered"] or by[t["id"]].get("clarified"))
    abstained = sum(1 for t in uns if not by[t["id"]]["answered"])
    lat = [by[t["id"]]["seconds"] for t in tests]
    return {"config": name, "citations_shown": len(shown), "citations_valid": valid,
            "citation_validity": round(valid / len(shown), 3) if shown else None,
            "hallucinated_citations_shown": len(shown) - valid,
            "answerable_with_correct_law_cited": f"{gold_hit}/{len(ans)}",
            "answerable_answered_or_clarified": f"{answered_ok}/{len(ans)}",
            "unsupported_correctly_not_answered": f"{abstained}/{len(uns)}",
            "clarify_asked": sum(1 for t in tests if by[t["id"]].get("clarified")),
            "latency_p50_s": round(statistics.median(lat), 1), "latency_p90_s": round(sorted(lat)[int(0.9 * len(lat)) - 1], 1)}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    tests = [json.loads(l) for l in (ROOT / "eval" / "testset.jsonl").open(encoding="utf-8")]
    eng = engine()
    runs = {"A": run_a, "B": run_b, "C": run_c}
    all_rows, summary = {}, []
    for name, fn in runs.items():
        rows = []
        for t in tests:
            t0 = time.time()
            try:
                r = fn(eng, t)
            except Exception as e:  # a crash counts as not answered, and is reported
                r = {"answered": False, "citations": [], "error": f"{type(e).__name__}: {e}"}
            r.update(id=t["id"], seconds=round(time.time() - t0, 1))
            rows.append(r)
        all_rows[name] = rows
        summary.append(score(name, rows, tests))
        print(json.dumps(summary[-1]), flush=True)

    # online fallback on the off-library prompts
    off = [t for t in tests if t["expect"] in ("online", "abstain")]
    online_rows = []
    for t in off:
        t0 = time.time()
        r = run_c(eng, t, online=True)
        r.update(id=t["id"], query=t["query"], expect=t["expect"], seconds=round(time.time() - t0, 1))
        online_rows.append(r)
        print("online", t["id"], r.get("level"), r["answered"], r["seconds"], flush=True)

    out = {"summary": summary, "rows": all_rows, "online_fallback": online_rows}
    (RESULTS / "ablation.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    lines = ["# Ablation (57 prompts: 49 answerable, 8 unsupported)", "",
             "| | A: LLM alone | B: LLM + search, no checks | C: Haq Assist (full) |", "|---|---|---|---|"]
    keys = [("Citations shown to the user", "citations_shown"), ("Citations valid (quote is in the official section)", "citation_validity"),
            ("Hallucinated citations shown", "hallucinated_citations_shown"),
            ("Answerable: correct law cited", "answerable_with_correct_law_cited"),
            ("Answerable: answered or asked for region", "answerable_answered_or_clarified"),
            ("Unsupported: correctly not answered", "unsupported_correctly_not_answered"),
            ("Latency p50 / p90 (s)", None)]
    for label, k in keys:
        vals = [(f"{s['latency_p50_s']} / {s['latency_p90_s']}" if k is None else
                 (f"{s[k]:.0%}" if isinstance(s[k], float) else str(s[k]))) for s in summary]
        lines.append(f"| {label} | " + " | ".join(vals) + " |")
    lines += ["", "## Online fallback (C with online search on, off-library prompts)", "",
              "| Prompt | Expected | Result | Level | Seconds |", "|---|---|---|---|---|"]
    for r in online_rows:
        lines.append(f"| {r['query'][:60]} | {r['expect']} | {'answered' if r['answered'] else 'not found'} | {r.get('level')} | {r['seconds']} |")
    (RESULTS / "ablation.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
