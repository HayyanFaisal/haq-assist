"""Retrieval of the deployed engine with live (deterministic) LLM rewrites, on the 49 labelled questions.
Run from the project folder: .venv\Scripts\python.exe eval\retrieval_deployed_check.py"""
import os, sys, json
os.environ.setdefault("CUDA_VISIBLE_DEVICES", "GPU-dcd92a54-ad5d-60fe-692f-264c71b64b3c"); os.environ.setdefault("HF_HOME", "models/hf")
sys.path.insert(0, "."); sys.stdout.reconfigure(encoding="utf-8")
from backend.app_state import engine
from backend import llm
e = engine()
tests = [json.loads(l) for l in open("eval/testset.jsonl", encoding="utf-8")]
h5 = h3 = n = 0; misses = []; pos = []; neg = []
for t in tests:
    region = t["region"] if t["region"] != "unknown" else None
    und = llm.understand(t["query"])
    src = e.search(t["query"], und, region)  # the app's retrieval (story-aware: up to 6 sources for multi-issue questions)
    top = src[0]["score"] if src else 0
    if not t["gold"]:
        neg.append(round(top, 3)); continue
    n += 1
    ids = [s["id"] for s in src]
    hit = next((i for i, x in enumerate(ids) if x in set(t["gold"])), None)
    h5 += hit is not None; h3 += hit is not None and hit < 3
    if hit is None: misses.append(t["id"])
    pos.append(round(top, 3))
print(f"LIVE rewrite retrieval: in sources given to the answer step {h5}/{n} top3 {h3}/{n} misses {misses}")
print("top prob, answerable: median", sorted(pos)[len(pos)//2], "min", min(pos), "| unsupported:", sorted(neg))
