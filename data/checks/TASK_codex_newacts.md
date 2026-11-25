# Codex task: sample audit of the three newly added acts

Read `D:\Codex Folder\GenAIProject.md` for your general rules. This is the same independent review you ran on the original library (see `data/checks/codex_review.md` for the format).

**New acts in `data/sections.jsonl`:**
- `limitation_act`: its First Schedule is deliberately excluded.
- `punjab_land_revenue`
- `punjab_women_property`

The PDFs are listed in `data/manifest.json` under `file`.

Sample **25 sections**: 10 from `punjab_land_revenue` (include 39, 42, 42-A if present, and 161–164), 8 from `limitation_act` (include 3, 5, 18), and 7 from `punjab_women_property` (include 4, 5, 7). For each one, open the PDF page and check:

1. **Boundaries:** the text starts at the right section number and title, and nothing from the next section leaks in.
2. **Text:** the body matches the PDF word for word. Ignore footnote markers and line breaks. Check that no footnotes or margin notes leaked in and nothing is missing.
3. **Page:** the `page` field is the PDF page where the section starts.
4. **Jurisdiction:** `applies_in` is correct (Limitation Act: all of Pakistan; the two Punjab acts: Punjab only).

**Output:**
- Write `data/checks/codex_newacts_review.md` with a results table (id, pass/fail per check, note), the totals, and a list of concrete fixes needed.
- Also check that the exclusion reason for `limitation_act:schedules` in `data/scope.json` is justified: is the schedule really unreliable as extracted?

**Rules:**
- Do not edit any other file.
- Do not read `eval/holdout/*`.
