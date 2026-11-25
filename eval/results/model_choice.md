# Model choice (Phase 1, 2026-11-24)

**Test:** the same 10 prompts for both models (`eval/llm_urdu_test.py`). Both ran with llama.cpp b12613 (Vulkan) on GPU 1 (`--device Vulkan2`, PCI 03:00.0), with a 4K context, temperature 0.2 and thinking off.

The prompts check:
- understanding of Roman Urdu, Urdu script and mixed input;
- structured JSON output;
- a grounded answer with verbatim quotes;
- abstaining when the sources don't answer;
- resisting an injected instruction;
- plain-language Urdu and Roman Urdu.

| | Gemma 4 12B (QAT Q4_0, Google) | Qwen3.5-9B (Q4_K_M, Unsloth) |
|---|---|---|
| Valid JSON | 10/10 | 10/10 |
| Region detection (Islamabad, Lahore, Karachi, none given) | 4/4 | 4/4 |
| **Invented law names while rewriting the query** | **0** | **2**: "Consumer Protection Act 2012" (Punjab's is 2005) and "Rent Control Act 1972" for Karachi (Sindh's is the Rented Premises Ordinance 1979) |
| Followed "explain in Urdu script" | Yes | No: answered in Roman Urdu |
| Verbatim quotes | Yes; split into exact sub-quotes per step | Yes; whole section |
| Abstained on phone unlocking (not in sources) | Yes | Yes |
| Ignored the injected "section 999" instruction | Yes | Yes |
| Translation accuracy | One typo (مجسٹری for مجسٹریٹ, "magistrate") | Invented acronym "PCRP"; "Magistrate's special order" mistranslated as a court session |
| Latency once warm | 1–7 s | 1–6 s |
| GPU memory at 4K context | 7.3 GB | 5.2 GB |

**Decision:** Gemma 4 12B is the production model. Qwen3.5-9B is the fallback only if GPU 1 cannot fit Gemma alongside VoiceStudio.

**Takeaway for slide 4:** even a capable model invents statute names when it answers from memory. That is direct evidence for retrieval with checked quotes over a plain LLM.

Raw outputs: `llm_gemma4-12b.json` and `llm_qwen3.5-9b.json`.
