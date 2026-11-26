# Codex review of the slides and script (2026-11-26)

Prompt: review twice, as a GenAI student hearing the project for the first time and as the professor grading it. Grades for the draft: clarity 7/10, technical substance 7/10. Changes made afterwards: one stolen-phone story through the whole talk; script trimmed to about 9 minutes; the 98% (design experiment) and 94% (final app) retrieval numbers explained; held-out story results reported; top-5 defined; trust labels named; province handling, temperature 0 and privacy stated precisely.

1. **Professor · Slides 1–10 · “Total spoken words: 1485.”** I count 1,481 spoken words after excluding the demo cue. At 140 words per minute, that’s **10:35 before the live demo**. Aim for 1,120–1,260 words. Cut the feature tour on Slide 1, summarize Slide 7 instead of reading the table, trim Slide 8 to one worked example, and reduce Slide 10 to a handoff.

2. **Professor · Slides 5–7 · “98%” / “94% (46 of 49)” / “41 of 49.”** I can’t tell why the top-five retrieval score is higher than the score for the sections the model reads. Label each result by stage, configuration, and denominator. Say, “Retrieval measures whether the system found the expected section. Citation accuracy measures whether the final answer cited it.” Explain the 98% versus 94% difference or correct the figures.

3. **Professor · Slide 6 · “40 real-life stories written by another AI” and “121 of 121.”** Report the separate result on those 40 held-out synthetic scenarios, or remove them from the spoken script. For the main test, say, “All 121 displayed quotes matched the source text. The final answer cited the expected law on 41 of 49 answerable questions.” Add how you checked whether the answer’s advice actually followed from the cited text, if you measured it.

4. **Student · Slides 1–4 and 10 · “Everything you will see runs on our own PC” and “Here’s Ali.”** The opening explains the product before I have a reason to care, then switches from a stolen phone to an arrest. Start with “Your brother’s phone is stolen, and the police clerk says he’ll register the complaint only after you find it yourself. Where would you check that?” Carry that story through the comparison, architecture, and demo. The moment I’d remember tomorrow is opening the official PDF to check the answer myself.

5. **Student · Slide 4 · “They must take him to a magistrate within 24 hours” and “The law doesn’t clearly say.”** The first sounds unconditional, and the second jumps from a search result to a conclusion about Pakistani law. Show the source and any relevant conditions beside the 24-hour example. For the unlocking question, say, “Haq Assist couldn’t verify an answer from the laws in its library.”

6. **Professor · Slides 3 and 5 · “ChatGPT and similar” and “needs thousands of checked examples.”** The problem → comparison → technique progression works, but the comparison makes claims broader than the experiment. Label the tested baseline “Gemma 4 without retrieval” in the results, and explain the design choice directly. “Retrieval gives us a source passage we can show the user, and we can update the law library when a law changes.”

7. **Student · Slides 5 and 8 · “Right section in the top 5” and “HyDE.”** “Top five” needs a definition before the chart, and the architecture gives me several new terms at once. Say, “We counted a hit if the expected section appeared among the first five search results.” Then trace one Roman Urdu query through rewrite, search, and checking. Keep *HyDE* on screen after explaining that the model generates law-like wording to help it search.

8. **Professor · Slide 8 · “Only that province’s laws” and “the same question always gives the same answer.”** Explain how the system keeps relevant federal law eligible and what happens when the user’s location is unclear. Replace the determinism claim with “We set temperature to zero to reduce sampling variability.” Use the saved time to explain what the checker does when it finds the quote but the quote doesn’t support the advice.

9. **Professor · Slide 6 · “54 laws” and “No training data needed.”** The corpus size is clear, but the data plan stops at collection. Add a line identifying which topics the 54 laws cover, how you track versions or amendments, and how a section links back to its PDF page. Label any update process that is still planned.

10. **Professor · Slide 7 · “No big difference,” “13.8 s,” and “nothing goes online unless you switch it on.”** Give the language rows the same named metric and show the raw counts. Say whether 13.8 seconds is a mean or median and whether it includes voice. Name the optional online feature and state what it sends so the privacy claim agrees with Slides 1 and 8.

11. **Professor · Slide 9 · “Each answer shows how much to trust it.”** Show the actual status or label the user sees and explain what triggers it. Use the rejected quotation to demonstrate a real failure: show the rejected wording, the official passage the app displays now, and what the user sees if the passage still fails to support the advice.

Clarity **7/10** · Technical substance **7/10**
