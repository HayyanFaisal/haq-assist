# Everyday-incident evaluation: everyday_dev.jsonl

- set: everyday_dev.jsonl
- baseline: False
- questions: 38
- answerable_answered: 30/33
- answerable_clarify: 1
- answerable_correct_law_cited: 21/33
- answerable_gold_in_sources_considered: 27/33
- unanswerable_correctly_not_answered: 4/5
- latency_p50_s: 13.3
- latency_p90_s: 15.7

| id | expect | result | level | correct law cited | cited |
|---|---|---|---|---|---|
| e01 | answer | answered | 2 | no | police_order:44 |
| e02 | answer | answered | 2 | yes | crpc:190, punjab_police:44 |
| e03 | answer | answered | 2 | yes | cpc:16, crpc:522, specific_relief:39 |
| e04 | answer | answered | 2 | no | punjab_police:125 |
| e05 | answer | answered | 2 | no | specific_relief:39, mflo:4 |
| e06 | answer | not_found | 4 | no |  |
| e07 | answer | answered | 2 | yes | punjab_rent:12 |
| e08 | answer | answered | 2 | yes | domestic_violence:8, domestic_violence:5 |
| e09 | answer | answered | 2 | yes | punjab_domestic_violence:7 |
| e10 | answer | answered | 2 | no | mflo:9, family_courts:9, family_courts:12A |
| e11 | answer | answered | 2 | yes | mflo:9 |
| e12 | answer | answered | 2 | yes | ppc:384, peca:21, ppc:386 |
| e13 | answer | answered | 2 | no | peca:2S |
| e14 | answer | answered | 2 | yes | workplace_harassment:11 |
| e15 | answer | answered | 2 | yes | ppc:489F |
| e16 | answer | answered | 2 | no | ict_consumer:5, ict_consumer:9, ict_consumer:8 |
| e17 | answer | answered | 1 | yes | police_order:156 |
| e18 | answer | answered | 2 | yes | ict_corporal_punishment:3, ict_corporal_punishment:6, ict_corporal_punishment:5 |
| e19 | answer | answered | 2 | yes | specific_relief:9, ict_senior_citizens:13 |
| e20 | answer | answered | 2 | yes | ict_domestic_workers:4, ict_domestic_workers:19 |
| e21 | answer | answered | 2 | yes | ict_child_marriage:7, ict_child_marriage:9 |
| e22 | answer | answered | 2 | no | rti:13, rti:12 |
| e23 | answer | clarify | None | no |  |
| e24 | answer | answered | 2 | no | crpc:161A |
| e25 | answer | answered | 2 | yes | juvenile_justice:5, constitution:10 |
| e26 | answer | answered | 1 | yes | punjab_consumer:28 |
| e27 | answer | answered | 2 | yes | crpc:497, crpc:496 |
| e28 | answer | not_found | 4 | no |  |
| e29 | answer | answered | 2 | yes | specific_relief:9, specific_relief:54 |
| e30 | answer | answered | 2 | no | family_courts:7, guardians_wards:12 |
| e31 | answer | answered | 1 | yes | constitution:10 |
| e32 | answer | answered | 2 | yes | sindh_rent:9 |
| e33 | answer | answered | 2 | yes | kp_domestic_violence:14 |
| e34 | abstain | not_found | 4 | no |  |
| e35 | abstain | not_found | 4 | no |  |
| e36 | abstain | not_found | 4 | no |  |
| e37 | abstain | not_found | 4 | no |  |
| e38 | abstain | answered | 2 | no | ict_consumer:8, ict_consumer:5 |
