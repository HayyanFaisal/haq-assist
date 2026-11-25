# Deployed retrieval check (final, story-aware engine, 2026-11-25)

Script: `eval/retrieval_deployed_check.py` (live, deterministic rewrites; the app's own `Engine.search`, up to 6 sources).

On the 49 labelled questions, a labelled section is among the sources given to the answer step for **46/49** (top 3: 44/49).

The 3 misses are r01, r02 and r03: the questions with no province. Since the story changes, a question without a province searches only nationwide laws, and the app first asks which province. Their labelled sections are provincial, so they are not retrieved until the user picks one. This is intended behaviour, not a search failure.

The earlier run (single-query search, before the story changes) scored 47/49 top-5 and 47/49 top-3, with the region supplied for every question. It is kept in `retrieval_deployed_before_story_changes.md`.

The selection experiment (`retrieval_experiments.md`) used cached rewrites and scored 48/49 top-5.

Reranker relevance is the model's own probability. Top probabilities on answerable questions go as low as 0.003, and on unsupported questions as high as 0.81, so confidence alone cannot separate them. The verification checks do that.
