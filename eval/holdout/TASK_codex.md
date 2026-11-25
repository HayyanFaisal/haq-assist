# Codex task: write a held-out "everyday incident" test set for Haq Assist

Read `D:\Codex Folder\GenAIProject.md` for your general rules. You are the independent test author. Claude tunes the system on its own dev set and must NOT see your questions until the final evaluation, so the results stay honest.

## What to write

Write `eval/holdout/everyday_holdout.jsonl`, one JSON object per line, with **40 questions**. Each one should read like a real ordinary Pakistani describing their own incident to a legal-help app, not like an exam question.

**Language and style**
- About 50% Roman Urdu, 25% English, 15% Urdu script and 10% mixed Urdu/English.
- Include typos, family terms (chachu, bhabhi, sasural), emotions and irrelevant detail.
- Lengths vary from one short line to 3–6 sentence stories with several issues. Some questions only describe what happened and never ask a clear legal question.

**Region**
- About half Islamabad. The rest are spread across Punjab, Sindh, KP and Balochistan.
- About 5 give no place at all.
- Put the place inside the story when there is one (city names, "Pindi", "G-9", "Lahore", etc.). The `region` field is what the app's region selector would be set to: `ict`, `punjab`, `sindh`, `kp`, `balochistan`, or `unknown`.

**Topics** (everyday incidents)
- Police: stops, searches, arrest, detention, FIR refusal, bribery, custodial torture.
- Traffic.
- Consumer: defective goods, services.
- Rent and tenancy: eviction, deposit, rent increase.
- Family: domestic violence, divorce, khula, maintenance, dowry, custody, child marriage.
- Inheritance and land: a relative grabbing land, a sister denied her share.
- Online: blackmail, harassment, fake profiles, fraud.
- Workplace harassment, cheque bounce, cheating and fraud.
- Senior citizens, domestic workers, corporal punishment at school.
- Getting government information (RTI), complaints against federal agencies, legal aid, juveniles.

**About 8 questions must be ones the library CANNOT answer.**
- They are realistic everyday questions whose governing law is not in `data/sections.jsonl`, e.g. tax, a specific scheme, or a law not in the library.
- Label them `"expect": "abstain"` with `"gold": []`.

## Labels: be careful, these decide the score

- **`gold`:** the library section ids (the `id` field in `data/sections.jsonl`, e.g. `crpc:61`) that directly answer the person's main legal question. Any one of them cited correctly counts as a hit.
  - Read each section's text before labelling it.
  - Respect jurisdiction: check `applies_in` / `level` and do not label a Punjab act for an Islamabad question.
  - Include 1–4 ids per question.
- **`expect`:** `"answer"` or `"abstain"`.
- **`note`:** one short line saying what a correct answer must say.

**Fields per line:** `id` (h01…h40), `lang` (`roman` / `en` / `ur` / `mixed`), `region`, `expect`, `query`, `gold`, `note`.

Also write `eval/holdout/README.md`, at most 15 lines:
- how you wrote and labelled the set;
- its topic, language and region counts;
- any label you are unsure about.

**Rules**
- Do not edit any other file.
- Do not read `eval/everyday_dev.jsonl` if it exists.
- Do not run the app or the models; just write the set.
