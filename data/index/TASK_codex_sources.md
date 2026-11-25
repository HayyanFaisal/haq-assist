# Codex task: find official PDFs for three more acts

Read `D:\Codex Folder\GenAIProject.md` for your general rules.

Haq Assist's library takes only official government copies, on `.gov.pk` / `.gob.pk` hosts. Find the official, current, consolidated PDF for each act below, open it, and confirm it is the right text.

1. **Punjab Land Revenue Act, 1967**, as in force in Punjab, from `punjabcode.punjab.gov.pk`. It covers the record of rights, mutations, and appeals and revision before revenue officers.
2. **Punjab Enforcement of Women's Property Rights Act, 2021**, from `punjabcode.punjab.gov.pk`.
   - If only the Ordinance 2021 exists there, say so.
   - Check whether an Act replaced the Ordinance, and give the Act if it exists.
3. **Limitation Act, 1908** (federal) from `pakistancode.gov.pk`. Confirm the PDF link.

**Output:** write `data/index/sources_new_codex.json`, a JSON array with one object per act:

| Field | What to put |
|---|---|
| `province` | Province, or "Federal" |
| `act_title` | Exact title as the site shows it |
| `year` | Year of the act |
| `url` | Direct PDF URL |
| `page_url` | The `show_article` page |
| `consolidated_until` | If the PDF says |
| `amendments` | List of amendments, if any |
| `verified_opened` | `true` / `false` |
| `notes` | What the PDF's first pages say; include its short-title section |

**Rules:**
- Only use `.gov.pk` / `.gob.pk` URLs.
- Do not edit any other file.
- Do not read `eval/holdout/*`.
- Mark anything you could not verify.
