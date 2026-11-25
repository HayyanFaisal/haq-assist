# Everyday-incident evaluation: everyday_dev.jsonl

- set: everyday_dev.jsonl
- baseline: False
- questions: 38
- answerable_answered: 30/33
- answerable_clarify: 1
- answerable_correct_law_cited: 23/33
- answerable_gold_in_sources_considered: 29/33
- unanswerable_correctly_not_answered: 4/5
- latency_p50_s: 13.9
- latency_p90_s: 16.6

| id | expect | result | level | correct law cited | cited |
|---|---|---|---|---|---|
| e01 | answer | answered | 2 | yes | crpc:154, crpc:173 |
| e02 | answer | answered | 2 | yes | punjab_police:35, punjab_police:44 |
| e03 | answer | answered | 2 | yes | ppc:423, ppc:467, specific_relief:9 |
| e04 | answer | not_found | 4 | no |  |
| e05 | answer | not_found | 4 | no |  |
| e06 | answer | answered | 2 | yes | ict_rent:17, ict_rent:5 |
| e07 | answer | answered | 2 | yes | punjab_rent:12 |
| e08 | answer | answered | 2 | yes | domestic_violence:8 |
| e09 | answer | answered | 2 | yes | punjab_domestic_violence:5, punjab_domestic_violence:8, punjab_police:106 |
| e10 | answer | answered | 2 | no | family_courts:7 |
| e11 | answer | answered | 2 | no | sindh_domestic_violence:12 |
| e12 | answer | answered | 2 | no | ppc:388, peca:24A |
| e13 | answer | answered | 2 | yes | peca:16, peca:24A |
| e14 | answer | answered | 2 | yes | workplace_harassment:8 |
| e15 | answer | answered | 2 | yes | ppc:489F |
| e16 | answer | answered | 2 | yes | peca:14, peca:13 |
| e17 | answer | answered | 2 | no | torture_custodial:2, torture_custodial:14 |
| e18 | answer | answered | 2 | yes | ict_corporal_punishment:3 |
| e19 | answer | answered | 2 | yes | specific_relief:9, ict_senior_citizens:13 |
| e20 | answer | answered | 2 | yes | ict_domestic_workers:19, ict_domestic_workers:6, ict_domestic_workers:4 |
| e21 | answer | answered | 2 | yes | ict_child_marriage:9 |
| e22 | answer | answered | 2 | yes | rti:3, rti:17 |
| e23 | answer | clarify | None | no |  |
| e24 | answer | answered | 2 | yes | legal_aid:9 |
| e25 | answer | answered | 1 | no | constitution:10 |
| e26 | answer | answered | 2 | yes | punjab_consumer:28, punjab_consumer:33 |
| e27 | answer | answered | 2 | yes | crpc:497 |
| e28 | answer | answered | 2 | no | police_order:106, police_order:152 |
| e29 | answer | answered | 2 | no | ppc:425, cpc:schedules |
| e30 | answer | answered | 2 | yes | sindh_domestic_violence:13, guardians_wards:17 |
| e31 | answer | answered | 2 | yes | constitution:10, crpc:60 |
| e32 | answer | answered | 2 | yes | sindh_rent:7 |
| e33 | answer | answered | 2 | yes | kp_domestic_violence:3, kp_domestic_violence:12 |
| e34 | abstain | not_found | 4 | no |  |
| e35 | abstain | not_found | 4 | no |  |
| e36 | abstain | not_found | 4 | no |  |
| e37 | abstain | clarify | None | no |  |
| e38 | abstain | answered | 2 | no | ict_consumer:9, wafaqi_mohtasib:10 |
