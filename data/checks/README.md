# How the statute library was verified (Phase 1, 2026-11-24; extended the same night)

**Library:** 54 official acts and 4,716 sections in `data/sections.jsonl`.
- **Federal and ICT, in depth:** 31 acts from Pakistan Code.
- **Provincial basics:** police, consumer, rent, workplace harassment, domestic violence and motor vehicles for Punjab, Sindh, KP and Balochistan; for Punjab also land revenue and women's property rights. 23 of the 26 collected acts are included.
- **Excluded rather than trusted:**
  - 3 provincial documents.
  - Punjab compilation Articles 61–72 (an Islamabad-only chapter).
  - The Limitation Act's First Schedule table.
  - 3 sections that Codex found garbled.
  - Reasons are in `data/scope.json`.

## Added later on 2026-11-24 (for everyday land and inheritance questions)

| Act | Source | Completeness | Codex sample (25 sections) |
|---|---|---|---|
| Limitation Act, 1908 | Pakistan Code | 28/30. §2 is not extracted; §§1 and 29 are excluded as garbled. | 6/8 pass |
| Punjab Land Revenue Act, 1967 (to 2026) | punjabcode.punjab.gov.pk | 202/202. §70-A is excluded. | 7/10 pass |
| Punjab Enforcement of Women's Property Rights Act 2021 | punjabcode.punjab.gov.pk | 13/13 | 7/7 pass |

- **Sources:** Codex found and opened the official PDFs (`data/index/sources_new_codex.json`). Provenance passes for all three.
- **Codex review:** `codex_newacts_review.md`. Two leaks were fixed with audited text replacements in `scope.json`: a footnote line in LRA §164 and a stray bracket in §42.
- **Limitation Act First Schedule:** excluded because its three-column table extracts column by column, which would separate each limitation period from its article. Codex confirmed this. A wrong deadline is the worst error the app could make.
- **Existing sections:** all 4,475 are byte-for-byte unchanged.

## The triple check

| Check | Method | Result |
|---|---|---|
| **1. Provenance** | Only .gov.pk / .gob.pk hosts are accepted, enforced in code. The file must be a real PDF whose SHA-256 is recorded in `manifest.json`, with the act's title on its first pages. | **57/57 pass** |
| **2. Completeness** | Each act's own contents list against the sections parsed. Footnotes (small type), superscripts, margin titles, running headers and page numbers are removed using the PDF layout. | **Federal/ICT 99.5%** (3,330 of 3,346 listed sections). **Provincial 98.1%** (1,373 of 1,400). 43 sections are missing in all, and the online fallback covers them. |
| **3a. Cross-copy** | Each federal section compared with an independent older scrape (HF AyeshaJadoon/Pakistan_Laws_Dataset), letter by letter so that spacing is ignored. | Median overlap is 1.00 for most acts. The Constitution (0.85) and PECA differ only where they were **amended after the older copy**, so our text is more current. |
| **3b. Independent review** | Codex (a different model family) compared sampled sections with the PDFs for boundary, wording and jurisdiction. | **Pass 1:** 61/90 pass. **Pass 2:** 9 of 25 fixed sections pass. **Pass 3:** 9/15 earlier failures and 14/20 new random sections pass. Every pass-3 finding was then fixed and confirmed by Claude; see below. |

## Act status

- **Complete (≥ 98%):** 41 acts.
- **Usable (85–97%):**
  - balochistan_police 45/46
  - balochistan_workplace_harassment 14/16
  - ict_senior_citizens 26/28
  - kp_mvo 122/126
  - kp_rent 20/22
  - punjab_consumer 39/40
  - sindh_consumer 39/40
  - sindh_mvo 123/129
  - sindh_rent 24/27
- **Partial:** sindh_domestic_violence 24/30.
- **No contents list:** dmma, split by section numbering (6 sections).
- **Excluded:**
  - **sindh_police:** broken text layer, and a schedule item collided with Article 2.
  - **balochistan_mvo:** the PDF is a Punjab-based text, so the Balochistan version is unverified.
  - **sindh_workplace_harassment_of_women:** it is the federal Act hosted by the federal ombudsperson, not a Sindh text.

## Jurisdiction model

Each section carries three fields:
- **level:** who made the law, e.g. federal, provincial, or "West Pakistan ordinance".
- **applies_in:** where it is the operative text.
- **scope_note:** the act's extent clause, quoted verbatim, plus any sourced caveat.

Example: Police Order 2002 on Pakistan Code is **federal**, extends to the whole of Pakistan, and **applies in ICT**. The note cites the IHC order in W.P. 2407/2020: "The Police Order, 2002 has been enforced".

## Fixed after Codex's findings

| Issue | Fix |
|---|---|
| Footnotes inside the text | Layout: small type at the page bottom; whitespace ignored when measuring line size |
| Running headers and page numbers | Lines repeated across pages, and number-only lines, removed |
| Margin titles stuck to the wrong section | Lines outside the text column marked and removed; the title is kept in its own field |
| Contents-list typos in titles | The enacted body heading is preferred |
| A section-number collision ("17." read as footnote "1" + "7.") | Bare glued digits allowed only when the title also matches |
| Exponential regex backtracking on number-heavy lines | Bounded patterns |
| Jurisdiction too coarse | The level / applies_in / scope_note model, plus per-section exclusions |

## Known minor issues

These are cosmetic and change no legal content:
- `sindh_mvo:57` ends with a stray "permit." on the same line as the final sentence.
- `crpc:25` ends with the repeal note for §§26–27 ("Rep. by A.O., 1937.").
- `sindh_rent` has no extent quote, because §1 is printed in a form the extractor misses.

## Files

| File | Contents |
|---|---|
| `triple_check.md` / `.json` | Per-act results |
| `split_report.json` | Contents-list entries, missing sections, parse mode |
| `codex_review.md` | Codex pass 1 |
| `codex_recheck.md` | Codex pass 2 |
| `codex_recheck2.md` | Codex pass 3 |
| `codex_newacts_review.md` | Codex sample of the three acts added later |
| `../manifest.json` | Provenance: URLs, SHA-256, download time |
| `../scope.json` | Jurisdiction rules and exclusions |
