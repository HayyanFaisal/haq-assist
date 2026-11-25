"""Retrieval over the statute library: chunking, BM25, dense embeddings, fusion, reranking.

Used by both the experiments (eval/retrieval_experiments.py) and the app, so the app runs
exactly the configuration the experiments selected (see backend/config.json).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
from rank_bm25 import BM25Okapi

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CACHE = ROOT / "models" / "index"
TOKEN = re.compile(r"[a-z0-9]+")
REGIONS = ["ict", "punjab", "sindh", "kp", "balochistan"]


def load_sections() -> list[dict]:
    return [json.loads(l) for l in (DATA / "sections.jsonl").open(encoding="utf-8")]


def header(s: dict) -> str:
    return f"{s['act']} - Section {s['section']}: {s['title']}"


# ---------------------------------------------------------------- chunking strategies
def _windows(text: str, size: int = 1000, overlap: int = 200) -> list[str]:
    if len(text) <= size:
        return [text]
    out, start = [], 0
    while start < len(text):
        end = min(len(text), start + size)
        if end < len(text):  # end on whitespace
            cut = text.rfind(" ", start + size // 2, end)
            end = cut if cut > 0 else end
        out.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return out


SUBSECTION = re.compile(r"\n(?=\(\d{1,2}[A-Za-z]?\)\s)")


def _subsections(text: str, min_len: int = 300, max_len: int = 1500) -> list[str]:
    parts, buf = [], ""
    for p in SUBSECTION.split(text):
        buf = f"{buf}\n{p}".strip() if buf else p.strip()
        if len(buf) >= min_len:
            parts.append(buf)
            buf = ""
    if buf:
        if parts and len(buf) < min_len:
            parts[-1] = f"{parts[-1]}\n{buf}"
        else:
            parts.append(buf)
    out = []
    for p in parts:
        out += _windows(p, max_len, 200) if len(p) > max_len else [p]
    return out


def make_chunks(sections: list[dict], strategy: str) -> list[dict]:
    """section: one chunk per section | window: ~1,000-char overlapping windows |
    subsection: one chunk per (1), (2)... block. Every chunk carries the act/section header."""
    chunks = []
    for s in sections:
        if strategy == "section":
            bodies = [s["text"][:4000]]
        elif strategy == "window":
            bodies = _windows(s["text"])
        elif strategy == "subsection":
            bodies = _subsections(s["text"])
        else:
            raise ValueError(strategy)
        for i, b in enumerate(bodies):
            chunks.append({"chunk_id": f"{s['id']}#{i}", "section_id": s["id"], "applies_in": s["applies_in"],
                           "text": f"{header(s)}\n{b}"})
    return chunks


def tokenize(t: str) -> list[str]:
    return TOKEN.findall(t.lower())


# ---------------------------------------------------------------- retrievers
class BM25:
    def __init__(self, chunks: list[dict]):
        self.bm25 = BM25Okapi([tokenize(c["text"]) for c in chunks])

    def scores(self, query: str) -> np.ndarray:
        return np.asarray(self.bm25.get_scores(tokenize(query)), dtype=np.float32)


MODELS = {
    "bge-m3": {"name": "BAAI/bge-m3", "query_prompt": None},
    "qwen3-emb-0.6b": {"name": "Qwen/Qwen3-Embedding-0.6B", "query_prompt": "query"},
}


class Dense:
    def __init__(self, key: str, chunks: list[dict], strategy: str, device: str = "cuda"):
        import torch
        from sentence_transformers import SentenceTransformer
        self.cfg = MODELS[key]
        # fp16 on the GPU (fits beside the LLM); full float32 on the CPU (some checkpoints default to bfloat16)
        kw = {"model_kwargs": {"torch_dtype": torch.float16 if device.startswith("cuda") else torch.float32}}
        self.model = SentenceTransformer(self.cfg["name"], device=device, **kw)
        self.model.max_seq_length = 512
        path = CACHE / f"{key}__{strategy}.npy"
        if path.exists() and np.load(path, mmap_mode="r").shape[0] == len(chunks):
            self.emb = np.load(path)
        else:
            self.emb = self.model.encode([c["text"] for c in chunks], batch_size=32, normalize_embeddings=True,
                                         show_progress_bar=False, convert_to_numpy=True).astype(np.float32)
            CACHE.mkdir(parents=True, exist_ok=True)
            np.save(path, self.emb)

    def scores(self, query: str) -> np.ndarray:
        kw = {"prompt_name": self.cfg["query_prompt"]} if self.cfg["query_prompt"] else {}
        q = self.model.encode([query], normalize_embeddings=True, convert_to_numpy=True, **kw)[0]
        return self.emb @ q


class Reranker:
    def __init__(self, name: str = "BAAI/bge-reranker-v2-m3", device: str = "cuda"):
        import torch
        from sentence_transformers import CrossEncoder
        kw = {"model_kwargs": {"torch_dtype": torch.float16}} if device.startswith("cuda") else {}
        self.model = CrossEncoder(name, device=device, max_length=512, **kw)

    def scores(self, query: str, texts: list[str]) -> np.ndarray:
        # CrossEncoder.predict already applies the model's sigmoid: a 0-1 relevance probability,
        # also shown as the answer's match confidence. (An earlier version applied sigmoid twice,
        # which kept the ranking but squeezed every score into 0.50-0.73.)
        return np.asarray(self.model.predict([(query, t) for t in texts], batch_size=16, show_progress_bar=False), dtype=np.float32)


# ---------------------------------------------------------------- fusion and ranking
def rrf(score_lists: list[np.ndarray], k: int = 60) -> np.ndarray:
    fused = np.zeros_like(score_lists[0])
    for s in score_lists:
        ranks = np.empty(len(s), dtype=np.int64)
        ranks[np.argsort(-s)] = np.arange(len(s))
        fused += 1.0 / (k + ranks + 1)
    return fused


def region_mask(chunks: list[dict], region: str | None) -> np.ndarray:
    if not region or region == "unknown":
        return np.ones(len(chunks), dtype=bool)
    return np.array([region in c["applies_in"] for c in chunks])


def top_sections(chunks: list[dict], scores: np.ndarray, mask: np.ndarray, k: int) -> list[tuple[str, int, float]]:
    """Best chunk per section, in score order: [(section_id, chunk_index, score)]."""
    s = np.where(mask, scores, -np.inf)
    order = np.argsort(-s)
    seen, out = set(), []
    for i in order:
        if not np.isfinite(s[i]):
            break
        sid = chunks[i]["section_id"]
        if sid not in seen:
            seen.add(sid)
            out.append((sid, int(i), float(s[i])))
            if len(out) == k:
                break
    return out
