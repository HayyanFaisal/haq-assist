# Haq Assist

Know your rights in Pakistan. Ask in Urdu, Roman Urdu or English; answers come in Urdu and English, with the excerpts of official law they rely on and a link to the government PDF page — or an honest "Not found". It is a local RAG prototype running as three services on one PC.

## Run it (on the prepared demo PC)

The launcher assumes this PC's paths: the llama.cpp build under `D:\Oc16CCTV\...\llama-b12613`, the `..\VoiceStudio` checkout with its `.venv`, this project's `.venv`, and the model files in `models\`. In PowerShell:

```powershell
.\start_haq.ps1
```

Then open http://127.0.0.1:8000. To close everything and free GPU 1:

```powershell
.\stop_haq.ps1
```

The script starts three services, all on GPU 1, the card with no display:

| Service | Port | What it is |
|---|---|---|
| llama.cpp | 8091 | Gemma 4 12B, the LLM |
| VoiceStudio | 3900 | Local Whisper transcription and OmniVoice Urdu speech ("Listen in Urdu") |
| Haq Assist | 8000 | FastAPI backend and the web app |

**The online switch** ("Search official government websites…") is **off by default** in a fresh browser and in the API:
- **Off:** answers come only from the library on this PC.
- **On:** if the library can't answer, the model's rewritten query is sent to external search providers (there is no separate personal-data filter), and evidence is taken only from .gov.pk / .gob.pk pages, including Pakistan Code fetched directly.

## The web app

The look comes from the logo: deep navy, emerald for the AI and search, and gold for verified law. Type is EB Garamond for headings and law quotes, Public Sans for the interface, and Noto Nastaliq Urdu for Urdu.

**Live pipeline**
- Pressing Enter, or **Ask Haq**, streams the engine's real progress from `POST /api/ask/stream` (one JSON event per line). Each step appears as it happens:
  1. Gemma reads the question (topic, province, legal-English rewrite).
  2. Each search angle lands in an area of law, e.g. "Property and land disputes → Specific Relief Act s. 9". The areas light up on a strip.
  3. The reviewed rights-card law is pinned.
  4. Gemma writes the answer.
  5. Every quote is shown verified (gold) or removed (with the reason).
- **Settings → Show how Haq works** turns this off. A one-line status shows instead.
- Every answer keeps its trace under "How this answer was found".

**Plans (demo)**

| Plan | Price | Questions a month |
|---|---|---|
| Free | Rs 0 | 8 |
| Haq Go | Rs 149 | 40 |
| Haq Plus | Rs 599 | 80 |
| Haq Ultra | Rs 899 | 150 |

- The meter in the header counts this month's questions on this device, in localStorage.
- At the limit, a sheet offers an upgrade. Switching plans in the demo is instant and free.
- Settings can reset the count. Features that don't exist yet are marked "Planned".

**Web standards used**
- Native `<dialog>` with `@starting-style` entry and exit animations.
- View transitions between pages, with focus moved to the new page.
- Scroll-driven reveals behind `@supports`.
- All motion respects the device's reduced-motion setting, and Settings → Reduce motion.
- The animated logo is a 538 KB WebP converted from the 28.8 MB GIF. A still image replaces it when motion is reduced.

## What is where

| Path | Contents |
|---|---|
| `backend/` | `engine.py`: understand → story-aware search → answer → verify → show. `search.py`: chunking, embeddings, reranker. `verify.py`: exact-quote (with snapping) and number checks. `online.py`: the hardened official-site fallback. `complaint.py`: ICT and Punjab drafts. `app.py`: the API. |
| `frontend/` | The web app (no build step) |
| `data/` | `manifest.json`: 57 official PDFs, with URLs and SHA-256. `sections.jsonl`: 4,716 sections from 54 acts. `scope.json`: where each law applies, plus audited exclusions and text fixes. `cards/`: 5 rights cards. `checks/`: the triple-check reports and Codex audits; see `checks/README.md`. |
| `scripts/` | Rebuilds the library: `pc_index` → `fetch_acts` → `split_sections` → `triple_check`; then `build_cards` |
| `eval/` | `testset.jsonl`: 57 labelled questions. `everyday_dev.jsonl`: 38 everyday stories used for tuning. `holdout/everyday_holdout.jsonl`: 40 stories written and labelled by Codex, not seen during tuning. `everyday_eval.py`: story evaluation, with `--baseline` replaying the earlier system. `retrieval_experiments.py`: 69 search configurations. `ablation.py`: A/B/C comparison. `llm_urdu_test.py`: model choice. Results are in `eval/results/`. |
| `models/` | GGUF LLMs, the Hugging Face cache and search indexes. Not in the repository (too large); see "Rebuilding from a fresh clone" |
| `docs/` | `Haq_Assist_Explained.md`: the team explainer (every design choice, its numbers, and how it maps to the RAG lecture). `Haq_Assist_Requirements_Architecture_Security.docx`/`.pdf`: the submission document, built by `scripts/make_doc.js`. `Demo_Script.md`: the 4–5 minute demo. `Presentation_Script.md`: what to say on each slide. `Library_Acts.md`: all 54 acts, with section counts and source portals. |
| `presentation/` | Source files of the slide deck |

## Rebuilding from a fresh clone

The repository leaves out the virtual environment, the model files (`models/`, about 12 GB) and the downloaded PDFs (`data/raw/`). To rebuild on another PC:
1. Create `.venv` from `pyproject.toml` (Python 3.12).
2. Download `gemma-4-12b-it-qat-q4_0.gguf` into `models/`. The embedding and reranker models download from Hugging Face on first run into `models/hf`.
3. Run `scripts/fetch_acts.py` to download the official PDFs. The search index is rebuilt automatically on the first question.
4. Edit the paths at the top of `start_haq.ps1` (llama.cpp and VoiceStudio).

## Key results

These were measured on 2026-11-24; see `eval/results/`.

- **Search:** at least one labelled section is in the top 5 for 48 of the 49 labelled test questions in the selection experiment (top 3: 46 of 49), and 46 of 49 in the deployed story-aware app, where the 3 misses are the questions with no province, which the app answers by asking for one (`eval/results/retrieval_deployed.md`). The same questions were used to select the configuration, with the region supplied. The selected setup is 1,000-character windows, the raw question plus the LLM's rewrite, BGE-M3 and Qwen3-Embedding fused, and the bge-reranker-v2-m3 reranker.
- **Model:** Gemma 4 12B was chosen over Qwen3.5-9B, which invented law names (`eval/results/model_choice.md`).
- **Library triple check:**
  - Provenance: 57/57 downloaded PDFs passed (official host, real PDF, SHA-256, title).
  - Completeness: among included acts with a contents list, 3,330/3,346 federal and ICT entries and 1,373/1,400 provincial entries were extracted.
  - Cross-copy: compared for 19 federal acts; overlap is high for most, with lower overlap in amended sections (e.g. Constitution, PECA) and a few others.
  - Codex review: three sampled passes, plus a 25-section sample of the three acts added later (20 passed; the rest were fixed or excluded).
- **Ablation:** the A/B/C results are in `eval/results/ablation.md`. The run before the story changes is kept as `ablation_before_story_changes.md`.

### Everyday stories (added the night of 2026-11-24)

People often describe what happened rather than ask a legal question.

**How story questions are handled:**
1. **Statute-style search sentences (HyDE):** the rewrite step writes up to three sentences phrased the way a statute would state the rule, one each for the person's rights, the remedy, and any offence. Each is searched separately alongside the whole question, and each angle's best section is kept, up to six sources. These sentences are only used for search; they are never shown or used as evidence.
2. **Quote snapping:** a quote that closely paraphrases one passage is replaced with the official wording, then must pass the number and support checks again. The checker also no longer misses near-identical quotes.
3. **No province given:** the app now searches only laws that apply nationwide. Before, a Sindh-only law could be cited.
4. **Answer temperature 0:** the same question gives the same answer.
5. **Rights-card pinning:** when the rewrite recognises a situation that has a reviewed rights card (FIR refused, arrest, stop and search, online harm, traffic challan), up to three of that card's law sections are always among the sources. They are still filtered by region and checked like any other source. The answer also links to the card.
   - This was added after the first final run, because FIR stories still missed CrPC 154 / 22-A.
   - The held-out set was re-run after it, so the held-out set is no longer completely blind to this one change.

**Results.** Library only. The original system was replayed on the same library (`--baseline`).

| Set | Measure | Original | New |
|---|---|---|---|
| Held-out: 40 stories by Codex, unseen during tuning | Correct law cited | 16/32 | **19/32** |
| | Answered | 26/32 | 30/32 |
| | Out-of-library correctly "Not found" | 8/8 | **8/8** |
| | Median time | 9.8 s | 13.2 s |
| Development: 38 stories used for tuning | Correct law cited | 19/34 | **21/34** |
| | Out-of-library correctly "Not found" | 4/4 | 4/4 |

"Correct law cited" is strict: the cited section must be one of the labelled ones. Several held-out "misses" cite a neighbouring section of the right act.

## Known limits

- **Urdu voice replies (demo only):**
  - "Listen in Urdu" uses OmniVoice through VoiceStudio. The user accepted its licences on 2026-11-25 for this non-commercial university demo.
  - The licences are CC-BY-NC for the voice weights, and the Boson Higgs Audio 2 Community License (based on Llama 3) for its audio tokenizer. A second tokenizer states no licence.
  - The required "Built with…" notice is in the app footer.
  - Measured: about 1.5 s per reply once warm, and 13.4 GB on GPU 1 with Gemma, the search models, Whisper and OmniVoice loaded. Generated speech carries VoiceStudio's AudioSeal watermark.
  - **The paid product can't use OmniVoice.** The subscriptions are commercial, so a launch needs a commercially licensed Urdu voice. That's why the Plans page still marks voice replies "Planned".
- **Lawyer profiles** are fictional demo data.
- **Coverage gaps:**
  - In our tests the app found no verified answer on compelled phone unlocking at a routine checkpoint. PECA §§33–36 cover device searches in investigations, a different context.
  - The Islamabad traffic card covers paper challans, not camera e-challans.
  - Some provincial sections are missing.
  - The Limitation Act's First Schedule (the table of deadlines) is excluded, so the app does not state limitation periods.
  - Such questions go to the online fallback or come back as "Not found".
- **Story questions still missed in the held-out set:**
  - Long Roman Urdu FIR stories can miss CrPC 154 / 22-A. The FIR rights card is correct, so demo that.
  - A daughter excluded from inheritance does not reach the women's-property law.
  - A child-marriage story missed the injunction section.
  - Latency rose by about 4 s because each angle is searched separately.

## Licences

| Component | Licence | Note |
|---|---|---|
| Gemma 4, Qwen3.5 | Apache-2.0 | |
| BGE-M3 | MIT | |
| Qwen3-Embedding, bge-reranker-v2-m3 | Apache-2.0 | |
| VoiceStudio | AGPL-3.0 | Our fork is public |
| OmniVoice (weights) | CC-BY-NC | Demo only; accepted by the user for the class presentation |
| OmniVoice audio tokenizer | Boson Higgs Audio 2 Community License (based on Meta Llama 3) | "Built with…" notice shown in the footer; under 100,000 annual users |
| Statutes | Official Pakistani government texts | |
