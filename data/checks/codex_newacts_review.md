# Sample audit of the three added acts

**25 sections checked. 20 passed all four checks and 5 failed at least one check.**

I used the local PDFs listed in `data/manifest.json` and verified their SHA-256 hashes against the manifest. I inspected the rendered pages and compared each sampled section’s full text, including continuation pages. Page numbers are 1-based PDF pages. The wording check ignores line breaks and inline footnote markers. A next-section heading or fragment fails the boundary check. Changes to a section’s own wording, including misplaced words and leaked footnote prose, fail the text check.

The sample includes all requested sections. I used the remaining slots to cover extent clauses, cross-page text, illustrations, the final included Limitation Act provision, and the Land Revenue Act’s rate table.

- [Limitation Act, 1908](../raw/federal/limitation_act.pdf) · [Pakistan Code source](https://pakistancode.gov.pk/pdffiles/administrator3294e35255f255ea96b3356091fb4844.pdf)
- [Punjab Land Revenue Act, 1967](../raw/punjab/punjab_land_revenue.pdf) · [Punjab Code source](https://punjabcode.punjab.gov.pk/uploads/articles/punjab-land-revenue-act-1967-pdf.pdf)
- [Punjab Enforcement of Women’s Property Rights Act 2021](../raw/punjab/punjab_women_property.pdf) · [Punjab Code source](https://punjabcode.punjab.gov.pk/uploads/articles/punjab-enforcement-of-womens-property-rights-act-2021-pdf1.pdf)

## Results

| ID | Boundaries | Text | Page | Jurisdiction | Note |
|---|---|---|---|---|---|
| `punjab_land_revenue:1` | Pass | Pass | Pass | Pass | PDF p. 11. Subsection (2) gives Punjab extent. |
| `punjab_land_revenue:39` | Pass | Pass | Pass | Pass | PDF p. 25. Stops after “prescribe.” before §40. |
| `punjab_land_revenue:41-A` | Pass | Pass | Pass | Pass | PDF p. 26. All three subsections present. |
| `punjab_land_revenue:42` | Fail | Pass | Pass | Pass | PDF pp. 27–29. Subsections (1)–(13) and the omission marks match. A lone opening amendment bracket from §42-A follows the closing bracket of §42(13). |
| `punjab_land_revenue:42-A` | Pass | Pass | Pass | Pass | PDF pp. 29–30. Correct section number, title and body wording, including the omission marks for (5)–(8). One of the three opening amendment brackets was assigned to §42. |
| `punjab_land_revenue:70-A` | Fail | Fail | Pass | Pass | PDF pp. 40–42. §70-A has no printed title. The record uses §70-B’s title and appends all of §70-B (PDF pp. 42–43). The table detaches rates from categories and drops the numbers `100`, `200`, `300`, and a `57` in category (a)’s rate cell. |
| `punjab_land_revenue:161` | Pass | Pass | Pass | Pass | PDF pp. 69–70. Includes the provisos, explanation and subsection (2). |
| `punjab_land_revenue:162` | Pass | Pass | Pass | Pass | PDF p. 70. The thirty-day appeal provision matches. |
| `punjab_land_revenue:163` | Pass | Pass | Pass | Pass | PDF pp. 70–71. The proviso continues correctly onto p. 71. |
| `punjab_land_revenue:164` | Pass | Fail | Pass | Pass | PDF pp. 71–72. The first line of p. 71’s footnote about substituting “ninety” appears between “variance:” and the next proviso. |
| `limitation_act:1` | Fail | Fail | Pass | Pass | PDF p. 3 is the correct start. After the heading, the record skips all three subsections and substitutes §2(4)–(11) from p. 4. The source’s §1(2) gives nationwide extent. |
| `limitation_act:3` | Pass | Pass | Pass | Pass | PDF p. 4. Includes the full explanation. |
| `limitation_act:5` | Pass | Pass | Pass | Pass | PDF p. 5. Includes the explanation. The separate asterisk row below it refers to §5A, as confirmed by footnote 3. |
| `limitation_act:12` | Pass | Pass | Pass | Pass | PDF pp. 7–8. Subsection (5) continues on p. 8. |
| `limitation_act:18` | Pass | Pass | Pass | Pass | PDF p. 9. Both clauses and the concluding paragraph match. |
| `limitation_act:20` | Pass | Pass | Pass | Pass | PDF p. 10. Includes the proviso, subsection (2) and explanation. |
| `limitation_act:25` | Pass | Pass | Pass | Pass | PDF p. 11. Includes both illustrations and stops before Part IV. |
| `limitation_act:29` | Fail | Fail | Pass | Pass | PDF pp. 12–13. “of 1872).” appears before subsection (1) instead of completing its citation after “(IX”. The record also appends the repeal entries for §§30–32. |
| `punjab_women_property:1` | Pass | Pass | Pass | Pass | PDF p. 2. Subsection (2) gives Punjab extent. |
| `punjab_women_property:2` | Pass | Pass | Pass | Pass | PDF p. 2. All six definitions present. |
| `punjab_women_property:4` | Pass | Pass | Pass | Pass | PDF pp. 2–3. The proviso and subsections (2)–(5) match. |
| `punjab_women_property:5` | Pass | Pass | Pass | Pass | PDF p. 3. All three subsections present. |
| `punjab_women_property:6` | Pass | Pass | Pass | Pass | PDF p. 3. Both subsections present. |
| `punjab_women_property:7` | Pass | Pass | Pass | Pass | PDF pp. 3–4. All six subsections present, including the proviso under (1). |
| `punjab_women_property:13` | Pass | Pass | Pass | Pass | PDF p. 4. The single repeal sentence matches. |

| Check | Pass | Fail |
|---|---:|---:|
| Boundaries | 21 | 4 |
| Text | 21 | 4 |
| Page | 25 | 0 |
| Jurisdiction | 25 | 0 |
| All four checks | 20 | 5 |

Fully passing sections by act were 7/10 for Land Revenue, 6/8 for Limitation and 7/7 for Women’s Property Rights. The two Punjab PDFs’ extent clauses support `["punjab"]`. The Limitation PDF’s extent clause supports the library’s nationwide mapping `["ict", "punjab", "sindh", "kp", "balochistan"]`.

## First Schedule exclusion

**The exclusion is justified for the current extraction.** The rendered First Schedule (PDF pp. 14–47) aligns descriptions, periods and starting events in three columns. I ran the current splitter’s `page_texts()` function on the manifest PDF. Its output loses both row associations and some cell content.

- On PDF p. 14, article 3’s description, six-month period and dispossession trigger align in one row. The extracted text groups descriptions first, then periods with the part headings, then triggering events.
- On PDF p. 22, articles 40–44 each have a printed “Three years” cell. The raw PDF text layer groups the five periods together. The splitter output drops all five row-level periods, retaining the part heading, and also drops the standalone `360` from article 43’s statutory reference.
- On PDF p. 46, the rendered rows pair article 179 with ninety days, articles 180 and 181 with three years, and article 183 with six years. The splitter puts the periods after the descriptions, drops article 181’s separate three-year cell and drops the `48` in its reference to section 48. Article 183’s description and starting-event proviso continue in different columns on p. 47.

The source table is readable by layout. Keep the exclusion until a layout-aware extraction can preserve and verify each article’s description, period, starting event and continuations. The scope entry’s separate statement that sections 1–29 are included overstates current coverage because §2 has no record. [Scope entry](../scope.json#L579)

## Concrete fixes

1. **Limitation §1 and missing §2.** Rebuild §1 from PDF p. 3 in visual reading order, retaining subsections (1)–(3). Create `limitation_act:2` starting on p. 3, with definitions (1)–(3) from p. 3 and (4)–(11) from p. 4. Stop before Part II. Check that scope coverage matches the resulting IDs. [§1 record](../sections.jsonl#L1530)
2. **Limitation §29.** Move “of 1872).” to the end of subsection (1)’s citation. End §29 at “extend.” in subsection (4) on PDF p. 13. Handle the subsequent repeal entries separately under the declared scope. [§29 record](../sections.jsonl#L1557)
3. **Land Revenue §§42 and 42-A.** End §42 after subsection (13) on PDF p. 29. Attach all three printed opening amendment brackets to the §42-A heading after removing their footnote numbers. [Affected records](../sections.jsonl#L3940)
4. **Land Revenue §70-A and missing §70-B.** Leave §70-A’s title empty to match the untitled source provision. Rebuild the rate table on PDF pp. 41–42 as four complete rows, pairing categories (a), (b), (c) and (d) with 50, 100, 200 and 300 per cent respectively and restoring the section 57 reference in (a). Restrict page-number removal to page furniture so standalone table numbers survive. Create `punjab_land_revenue:70-B` from its heading and text on pp. 42–43. [§70-A record](../sections.jsonl#L3972)
5. **Land Revenue §164.** Remove the leaked footnote line after “variance:” and join directly to the continuation proviso on PDF p. 72. Preserve the amendment note separately if needed. [§164 record](../sections.jsonl#L4074)
