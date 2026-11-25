# Codex review of the requirements report (draft 2, 2026-11-25)

Prompt: read as a PhD GenAI professor seeing the report for the first time. Grade given: 7/10. Every item below was addressed in the final report except item 1 (a lawyer-scored, answer-level evaluation), which is stated as the main limitation.

1. **MISSING** — Report how often the system gives a legally correct, complete answer. The current metric credits any response that cites at least one labelled section, even if another step misstates the law or omits an exception. Give the scoring rubric and say who judged the answers.
2. **INCONSISTENT** — “Ask when the answer depends on the province” conflicts with “with no province given, only nationwide law.” Say whether the implemented system asks a follow-up, and report a test of that behavior.
3. **UNCLEAR** — “With the optional online switch” leaves the verification path ambiguous. Does web-derived advice pass the same quote, number, jurisdiction and support checks before display? What happens when a check fails?
4. **UNSUPPORTED** — “Zero invented law” is broader than “121 of 121 verifiable.” Exact quotes can still be misapplied. State the measured result at citation level, and reconcile the targets “≥ 95% verifiable” and “0 unverifiable shown.”
5. **MISSING** — State which question sets were used to select the 69 retrieval configurations and tune the guardrails. Explain what A, B and C shared in their prompts, output instructions and access to jurisdiction information. This determines how to interpret the Q57 comparison.
6. **UNCLEAR** — “Held-out stories 16/32 → 19/32” does not identify what changed. Name both configurations and report how often the full system declined an answerable story.
7. **UNCLEAR** — “English 27/27, Roman Urdu 12/17” leaves three of Q57’s 49 answerable questions unaccounted for even after including both Urdu-script questions. Give complete denominators, include mixed-language stories, and define a measurable threshold for “No large gap.”
8. **UNSUPPORTED** — “Hidden instructions are ignored” rests on one fake-section case returning “Not found.” Report attempted and failed cases by input source, and distinguish an attack being resisted from the system declining for another reason.
9. **MISSING** — Define how the quote similarity score is computed, what happens above 96%, and what the same-model support check accepts. A genuine number can still be attached to the wrong deadline or condition. Report whether the verifier caught such errors in testing.
10. **UNSUPPORTED** — “All runs use temperature 0, so they are repeatable” and “Repeatable runs” need repeated-run results. Specify what stayed identical and what “small changes” refers to.
11. **UNCLEAR** — “Independent auditor” describes Codex, which also authored the held-out set. State what Codex could see, who adjudicated disputed labels, and what legal expertise, if any, informed the labels.
12. **CUT** — Remove proposed prices, fictional lawyer profiles and fairness across price plans unless an implemented plan changes answer quality.
13. **CUT** — Compress speech-stack details, licensing and referral rules, and generic hosting limits. Use the space for evaluation of the implemented generation and verification controls.

**Grade: 7/10.** The single biggest improvement would be a held-out, answer-level evaluation that scores legal correctness, completeness and appropriate abstention against a stated rubric.
