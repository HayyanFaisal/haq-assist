90 checked, 61 pass, 29 fail.

| ID | Check that failed | What is wrong | Suggested fix |
|---|---|---|---|
| `police_order:156` | Jurisdiction | Article 156 matches the PDF. Article 1(2) gives the Order nationwide extent, and Article 1(3) sets a separate commencement condition for ICT. The PDF is the general Order. | Index Article 156 under the federal base text and track ICT commencement and provincial versions separately. |
| `ict_rent:5` | Content | The footnote about the notification declaring urban areas appears between subsections (1) and (2). | Remove the footnote from the section body and join the subsections across PDF pp. 4–5. |
| `workplace_harassment:8` | Jurisdiction | Section 1(2) of the federal workplace harassment Act extends it to the whole of Pakistan. | Tag the federal version `federal`. |
| `balochistan_consumer:6` | Boundary | The extract drops §6’s marginal heading and ends with §7’s heading, “Prohibition of false advertisement, etc.” | Start with “Receipts to be issued to the purchaser” and stop before §7’s heading. |
| `balochistan_domestic_violence:22` | Boundary | The extract drops “Procedure” and appends §23’s heading about actions taken in good faith. | Start with “Procedure” and stop after “shall be governed by the Code.” |
| `balochistan_mvo:1` | Jurisdiction | Section 1(2) says the whole of Pakistan. The PDF incorporates Punjab-specific provisions and gives no basis for identifying this copy as the Balochistan version. | Verify the Balochistan consolidation and extract §1 from that source. |
| `balochistan_mvo:3` | Jurisdiction | The driving-licence text matches the supplied PDF, which incorporates Punjab-specific provisions. The Balochistan version is unverified. | Verify §3 against the Balochistan consolidation before indexing it under `balochistan`. |
| `balochistan_police:46` | Boundary, content | “Repeal and savings” is missing from the start. A gazette and repeal-history footnote interrupts §46(1)(b). | Place the heading at the start and join the clause across PDF pp. 20–21 after removing the footnote. |
| `balochistan_police:47` | Boundary | The extract drops §47’s heading and appends §48’s “Power to remove difficulties.” | Attach §47’s own heading and stop before §48’s heading. |
| `balochistan_rent:5` | Boundary | The extract drops §5’s heading and appends §6’s heading about charging above fair rent. | Attach “Case in which further increase in fair rent admissible” and stop at the end of §5(3). |
| `balochistan_workplace_harassment_of_women:11` | Boundary, content | The extract drops “Responsibility of employer,” inserts the footnote about the addition of §10-A inside subsection (1), and appends §12’s heading. | Attach §11’s heading, remove the footnote, and stop at the end of subsection (4). |
| `kp_mvo:72` | Boundary | The marginal heading interrupts subsections (2) and (3), and the next chapter heading appears at the end. | Move the marginal heading to the start and stop before Chapter VI. |
| `kp_rent:18` | Boundary | The correct marginal heading, “Landlord and tenant to furnish particulars,” appears after the body. | Move the heading to the start of §18. |
| `mvo_1965:64` | Jurisdiction | Section 1(2) gives nationwide extent. The PDF attributes §64 to a 1970 West Pakistan amendment and gives no ICT-specific basis for this provision. | Index §64 under the base ordinance, with any verified territorial application recorded separately. |
| `mvo_1965:65` | Jurisdiction | The omission marker matches the PDF. The source attributes the omission to a 1970 West Pakistan amendment and gives no ICT-specific basis for it. | Record the omission under the base ordinance. |
| `police_order:148` | Jurisdiction | Article 148 matches the general Order. Article 1 gives nationwide extent and provides a separate ICT commencement condition. | Index Article 148 under the federal base text and track territorial applicability separately. |
| `police_order:36` | Boundary, jurisdiction | The extract includes the Chapter V heading after Article 36. Article 36 appears in the general Order, whose Article 1 gives nationwide extent. | Stop before Chapter V and index Article 36 under the federal base text. |
| `punjab_consumer:3` | Boundary | The extract appends the Part II heading on defective products. | Stop at the last sentence of §3. |
| `punjab_police:70` | Jurisdiction | Article 70 governs removal of members of the Islamabad District Public Safety Commission. The Punjab compilation retains that ICT provision. | Assign Article 70 to the ICT scope and source it from the general Order. |
| `qso:101` | Boundary | The extract appends the Chapter VI heading and separator. | Stop after the final sentence of Article 101. |
| `rti:16` | Jurisdiction | Section 1(2) applies the Act to all public bodies of the Federal Government. | Tag it `federal` and retain the federal-public-body scope. |
| `sindh_consumer:27` | Boundary | “Establishment of Consumer Courts” appears after subsection (3). | Move the marginal heading to the start of §27. |
| `sindh_domestic_violence:29` | Boundary | “Power to make rules” appears after the body. | Move the marginal heading to the start of §29. |
| `sindh_mvo:69` | Boundary, content | The marginal heading interrupts the list, and page number `70` and the running header appear before item (ix). | Move the heading to the start and join items (viii) and (ix) across the page break. |
| `sindh_mvo:90` | Boundary, content | The marginal heading, page number `80`, and running header interrupt subsection (3) before its proviso. | Move the heading to the start and join subsection (3) to its proviso. |
| `sindh_police:2` | Boundary, content | The extract is item 2, “Junior Police Ranks,” from the First Schedule on PDF p. 34. Article 2, “Definitions,” begins on PDF p. 2. | Re-extract Article 2 from the body and give schedule items distinct IDs. |
| `sindh_rent:7` | Boundary, content | The extract contains §17 on compensation for vexatious eviction. Section 7, “Higher rent not chargeable,” appears on PDF p. 6. | Replace the extract with §7 and require an exact section-number match. |
| `sindh_workplace_harassment_of_women:3` | Content, jurisdiction | A page number and Gazette running header interrupt §3(4). The supplied federal Act extends to the whole of Pakistan under §1(2). | Remove the page furniture and tag this source version `federal`. |
| `workplace_harassment:13` | Jurisdiction | Section 1(2) extends the Act to the whole of Pakistan, and §13 names the Federal Government as the rulemaking authority. | Tag the federal version `federal`. |

- Marginal headings, chapter headings, page furniture, and footnotes recur at extraction boundaries. Use the PDF layout to associate headings with their own provisions and strip page furniture before joining text across pages.
- Section lookup needs exact number matching and awareness of the document’s body and schedules. The two wrong-provision records came from a section-number collision and a schedule item.
- Derive jurisdiction from the extent clause, the source version, and any provision-specific scope. Folder names and publication hosts alone leave those distinctions unresolved.
- Wording checks cover the supplied excerpts, capped at 1,500 characters per sample.