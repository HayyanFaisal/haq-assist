# Deployed retrieval check (2026-11-24, final code)

The selection experiment (`retrieval_experiments.md`) used cached LLM rewrites and scored 48/49 top-5 and 46/49 top-3.

The deployed engine uses deterministic rewrites (temperature 0) with the final rewrite prompt, which keeps the user's goal, e.g. "where to complain". On the same 49 labelled questions, with the region supplied, it scores **47/49 top-5 and 47/49 top-3**. The misses are q17 (which agency handles online fraud) and q38 (defamation).

Reranker relevance is now reported as the model's own probability. An earlier version applied the sigmoid twice, which kept the ranking but compressed every score into 0.50–0.73. Top probabilities:
- **Answerable questions:** median 0.54, minimum 0.003.
- **Unsupported questions:** 0.001–0.81, so confidence alone cannot separate them. The verification checks do that.

Script: `eval/retrieval_deployed_check.py`
