# Retrieval experiments

Test set: 49 answerable prompts (eval/testset.jsonl). Section-level hits.

| # | Chunking | Query | Retriever | Rerank | R@1 | R@3 | R@5 | MRR@10 |
|---|---|---|---|---|---|---|---|---|
| 1 | window | raw+rewrite | bge-m3+qwen3 | yes | 0.71 | 0.94 | 0.98 | 0.82 |
| 2 | window | raw+rewrite | qwen3-emb-0.6b | yes | 0.73 | 0.94 | 0.96 | 0.84 |
| 3 | window | raw+rewrite | qwen3-emb-0.6b | no | 0.71 | 0.86 | 0.96 | 0.80 |
| 4 | window | raw+rewrite | bge-m3+qwen3 | no | 0.76 | 0.88 | 0.94 | 0.83 |
| 5 | subsection | raw+rewrite | qwen3-emb-0.6b | no | 0.71 | 0.88 | 0.94 | 0.80 |
| 6 | subsection | raw+rewrite | bge-m3 | yes | 0.69 | 0.88 | 0.94 | 0.80 |
| 7 | subsection | raw+rewrite | bge-m3+qwen3 | yes | 0.67 | 0.88 | 0.94 | 0.78 |
| 8 | subsection | raw+rewrite | qwen3-emb-0.6b | yes | 0.65 | 0.84 | 0.94 | 0.77 |
| 9 | subsection | raw+rewrite | bge-m3+qwen3 | no | 0.76 | 0.86 | 0.92 | 0.82 |
| 10 | subsection | raw+rewrite | bm25+bge-m3+qwen3 | yes | 0.69 | 0.86 | 0.92 | 0.79 |
| 11 | subsection | raw+rewrite | bm25+bge-m3+qwen3 | no | 0.67 | 0.84 | 0.90 | 0.77 |
| 12 | subsection | raw+rewrite | bge-m3 | no | 0.67 | 0.84 | 0.90 | 0.76 |
| 13 | window | raw+rewrite | bm25+bge-m3+qwen3 | no | 0.63 | 0.88 | 0.90 | 0.76 |
| 14 | subsection | rewrite | qwen3-emb-0.6b | no | 0.63 | 0.84 | 0.90 | 0.75 |
| 15 | window | raw+rewrite | bm25+qwen3 | no | 0.59 | 0.82 | 0.90 | 0.72 |
| 16 | window | rewrite | bm25+bge-m3+qwen3 | no | 0.59 | 0.78 | 0.90 | 0.71 |
| 17 | subsection | rewrite | bge-m3 | no | 0.59 | 0.78 | 0.90 | 0.71 |
| 18 | window | rewrite | bge-m3+qwen3 | no | 0.76 | 0.84 | 0.88 | 0.81 |
| 19 | subsection | rewrite | bge-m3+qwen3 | no | 0.73 | 0.84 | 0.88 | 0.79 |
| 20 | section | raw+rewrite | bge-m3+qwen3 | no | 0.69 | 0.86 | 0.88 | 0.78 |
| 21 | section | raw+rewrite | qwen3-emb-0.6b | no | 0.67 | 0.80 | 0.88 | 0.75 |
| 22 | window | rewrite | bge-m3 | no | 0.65 | 0.80 | 0.88 | 0.74 |
| 23 | window | raw+rewrite | bge-m3 | no | 0.59 | 0.84 | 0.88 | 0.73 |
| 24 | section | raw+rewrite | bm25+bge-m3+qwen3 | no | 0.61 | 0.76 | 0.88 | 0.71 |
| 25 | subsection | raw+rewrite | bm25+qwen3 | no | 0.63 | 0.80 | 0.86 | 0.73 |

**Abstain threshold:** top reranker score < 0.51 -> 'Not found' (separates correct answers from unsupported questions with accuracy 86%).
