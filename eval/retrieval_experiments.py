"""Retrieval experiments: which chunking, search method, query form and reranking finds the
right law most often? Scored on eval/testset.jsonl (section-level hits).

Grid: chunking {section, window, subsection} x query {raw, rewrite, raw+rewrite} x
retriever {BM25, BGE-M3, Qwen3-Embedding-0.6B, hybrids via reciprocal rank fusion},
then the best configurations again with a cross-encoder reranker (bge-reranker-v2-m3).

The region filter uses the test's labelled region (in the app the user confirms it).
Writes eval/results/retrieval_experiments.{json,md} and backend/config.json (the winner).
"""
import os

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "GPU-dcd92a54-ad5d-60fe-692f-264c71b64b3c")  # GPU 1, no display
os.environ.setdefault("HF_HOME", os.path.join(os.path.dirname(__file__), "..", "models", "hf"))

import json
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend import llm  # noqa: E402
from backend.search import (BM25, MODELS, Dense, Reranker, load_sections, make_chunks, region_mask, rrf,  # noqa: E402
                            top_sections)

RESULTS = ROOT / "eval" / "results"
K = 10


def metrics(ranked: dict[str, list[str]], tests: list[dict]) -> dict:
    r1 = r3 = r5 = mrr = 0.0
    n = 0
    for t in tests:
        if not t["gold"]:
            continue
        n += 1
        got = ranked[t["id"]]
        gold = set(t["gold"])
        hit = next((i for i, sid in enumerate(got) if sid in gold), None)
        if hit is not None:
            r1 += hit < 1
            r3 += hit < 3
            r5 += hit < 5
            mrr += 1 / (hit + 1)
    return {"R@1": r1 / n, "R@3": r3 / n, "R@5": r5 / n, "MRR@10": mrr / n, "n": n}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    RESULTS.mkdir(parents=True, exist_ok=True)
    tests = [json.loads(l) for l in (ROOT / "eval" / "testset.jsonl").open(encoding="utf-8")]

    # 1) LLM rewrites (cached)
    rw_path = RESULTS / "rewrites.json"
    rewrites = json.loads(rw_path.read_text(encoding="utf-8")) if rw_path.exists() else {}
    for t in tests:
        if t["id"] not in rewrites:
            rewrites[t["id"]] = llm.understand(t["query"])
    rw_path.write_text(json.dumps(rewrites, ensure_ascii=False, indent=1), encoding="utf-8")
    region_acc = np.mean([rewrites[t["id"]]["region"] == t["region"] for t in tests])
    print(f"rewrites ready; LLM region detection matches the label on {region_acc:.0%} of prompts", flush=True)

    def qtext(t: dict, mode: str) -> str:
        rw = rewrites[t["id"]]["english_query"]
        return {"raw": t["query"], "rewrite": rw, "raw+rewrite": f"{t['query']} {rw}"}[mode]

    sections = load_sections()
    rows, runs = [], {}
    for strategy in ["section", "window", "subsection"]:
        chunks = make_chunks(sections, strategy)
        t0 = time.time()
        bm25 = BM25(chunks)
        dense = {m: Dense(m, chunks, strategy) for m in MODELS}
        print(f"[{strategy}] {len(chunks)} chunks, indexes ready in {time.time() - t0:.0f}s", flush=True)
        masks = {t["id"]: region_mask(chunks, t["region"]) for t in tests}
        for mode in ["raw", "rewrite", "raw+rewrite"]:
            sc = {t["id"]: {"bm25": bm25.scores(qtext(t, mode)), **{m: d.scores(qtext(t, mode)) for m, d in dense.items()}}
                  for t in tests}
            combos = {"bm25": ["bm25"], "bge-m3": ["bge-m3"], "qwen3-emb-0.6b": ["qwen3-emb-0.6b"],
                      "bm25+bge-m3": ["bm25", "bge-m3"], "bm25+qwen3": ["bm25", "qwen3-emb-0.6b"],
                      "bge-m3+qwen3": ["bge-m3", "qwen3-emb-0.6b"], "bm25+bge-m3+qwen3": ["bm25", "bge-m3", "qwen3-emb-0.6b"]}
            for name, parts in combos.items():
                ranked, fused_all = {}, {}
                for t in tests:
                    s = sc[t["id"]][parts[0]] if len(parts) == 1 else rrf([sc[t["id"]][p] for p in parts])
                    fused_all[t["id"]] = s
                    ranked[t["id"]] = [sid for sid, _, _ in top_sections(chunks, s, masks[t["id"]], K)]
                m = metrics(ranked, tests)
                rows.append({"chunking": strategy, "query": mode, "retriever": name, "rerank": False, **m})
                runs[(strategy, mode, name)] = (chunks, fused_all, masks)
        print(f"[{strategy}] done", flush=True)

    # 2) rerank the 6 best first-stage configurations
    best = sorted([r for r in rows if not r["rerank"]], key=lambda r: (r["R@5"], r["MRR@10"]), reverse=True)[:6]
    reranker = Reranker()
    confidences = {}
    for r in best:
        chunks, fused_all, masks = runs[(r["chunking"], r["query"], r["retriever"])]
        ranked, conf = {}, {}
        for t in tests:
            cand = top_sections(chunks, fused_all[t["id"]], masks[t["id"]], 30)
            q = qtext(t, "raw+rewrite") if r["query"] != "raw" else t["query"]
            rs = reranker.scores(q, [chunks[i]["text"] for _, i, _ in cand])
            order = np.argsort(-rs)
            ranked[t["id"]] = [cand[j][0] for j in order[:K]]
            conf[t["id"]] = float(rs[order[0]]) if len(order) else 0.0
        m = metrics(ranked, tests)
        rows.append({"chunking": r["chunking"], "query": r["query"], "retriever": r["retriever"], "rerank": True, **m})
        confidences[(r["chunking"], r["query"], r["retriever"])] = (conf, ranked)
        print(f"rerank {r['chunking']}/{r['query']}/{r['retriever']}: R@5 {r['R@5']:.2f} -> {m['R@5']:.2f}", flush=True)

    rows.sort(key=lambda r: (r["R@5"], r["MRR@10"], r["R@1"]), reverse=True)
    winner = rows[0]

    # 3) abstain threshold from the winner's top reranker score (or note that it has none)
    calib = None
    key = (winner["chunking"], winner["query"], winner["retriever"])
    if winner["rerank"] and key in confidences:
        conf, ranked = confidences[key]
        pos = [conf[t["id"]] for t in tests if t["gold"] and ranked[t["id"]] and ranked[t["id"]][0] in set(t["gold"])]
        neg = [conf[t["id"]] for t in tests if t["expect"] in ("abstain", "online")]
        best_th, best_acc = 0.5, -1
        for th in np.linspace(0.01, 0.99, 99):
            acc = (sum(c >= th for c in pos) + sum(c < th for c in neg)) / (len(pos) + len(neg))
            if acc > best_acc:
                best_th, best_acc = float(th), acc
        calib = {"threshold": round(best_th, 2), "accuracy": round(best_acc, 3),
                 "answerable_top1_correct_scores": sorted(round(c, 3) for c in pos),
                 "unsupported_scores": sorted(round(c, 3) for c in neg)}

    out = {"rows": rows, "winner": winner, "abstain_calibration": calib, "region_detection_accuracy": float(region_acc)}
    (RESULTS / "retrieval_experiments.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    (ROOT / "backend" / "config.json").write_text(json.dumps({
        "chunking": winner["chunking"], "query": winner["query"], "retriever": winner["retriever"],
        "rerank": winner["rerank"], "abstain_threshold": calib["threshold"] if calib else None}, indent=1), encoding="utf-8")

    lines = ["# Retrieval experiments", "", f"Test set: {winner['n']} answerable prompts (eval/testset.jsonl). Section-level hits.", "",
             "| # | Chunking | Query | Retriever | Rerank | R@1 | R@3 | R@5 | MRR@10 |", "|---|---|---|---|---|---|---|---|---|"]
    for i, r in enumerate(rows[:25], 1):
        lines.append(f"| {i} | {r['chunking']} | {r['query']} | {r['retriever']} | {'yes' if r['rerank'] else 'no'} | "
                     f"{r['R@1']:.2f} | {r['R@3']:.2f} | {r['R@5']:.2f} | {r['MRR@10']:.2f} |")
    if calib:
        lines += ["", f"**Abstain threshold:** top reranker score < {calib['threshold']} -> 'Not found' "
                      f"(separates correct answers from unsupported questions with accuracy {calib['accuracy']:.0%})."]
    (RESULTS / "retrieval_experiments.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines[:16]))
    print("winner:", winner, "\ncalibration:", calib)


if __name__ == "__main__":
    main()
