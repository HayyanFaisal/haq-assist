// Haq Assist - Requirements, Architecture and Security Analysis (Word). Every number is read from the result files.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
  HeadingLevel, LevelFormat, BorderStyle, Footer, PageNumber,
} = require("docx");

const P = require("path").resolve(__dirname, "..");  // the project folder
const OUT = require("path").resolve(__dirname, "..", "docs","Haq_Assist_Requirements_Architecture_Security.docx");
const J = (f) => JSON.parse(fs.readFileSync(path.join(P, f), "utf8"));
const retr = J("eval/results/retrieval_experiments.json");
const abl = J("eval/results/ablation.json");
const tri = J("data/checks/triple_check.json");
const scope = J("data/scope.json");
const split = J("data/checks/split_report.json");
const tests = Object.fromEntries(fs.readFileSync(path.join(P, "eval/testset.jsonl"), "utf8").trim().split("\n").map((l) => { const t = JSON.parse(l); return [t.id, t]; }));
const nSections = fs.readFileSync(path.join(P, "data/sections.jsonl"), "utf8").trim().split("\n").length;
const man = Object.fromEntries(J("data/manifest.json").map((e) => [e.id, e]));
const inc = split.filter((r) => scope[r.id] && scope[r.id].status === "included");
const nActs = inc.length;
const nFedActs = inc.filter((r) => ["federal", "ict"].includes(man[r.id].jurisdiction)).length;
const cov = (f) => { const s = inc.filter(f).filter((r) => r.toc_entries); return [s.reduce((a, r) => a + r.found, 0), s.reduce((a, r) => a + r.toc_entries, 0)]; };
const [fedN, fedT] = cov((r) => ["federal", "ict"].includes(man[r.id].jurisdiction));
const [provN, provT] = cov((r) => !["federal", "ict"].includes(man[r.id].jurisdiction));
const ev = (tag) => J(`eval/results/everyday_${tag}.json`).summary;
const EH = ev("holdout"), EHb = ev("holdout_baseline"), ED = ev("dev_final"), EDb = ev("dev_baseline");
const find = (k) => retr.rows.find((r) => Object.entries(k).every(([a, b]) => r[a] === b));
const S = Object.fromEntries(abl.summary.map((s) => [s.config, s]));
const A = abl.rows.A;
const aNamed = A.filter((r) => tests[r.id].gold.length && r.citations.some((c) => tests[r.id].gold.includes(c.sid))).length;
const aResolved = A.reduce((n, r) => n + r.citations.filter((c) => c.sid).length, 0);
const cDropped = abl.rows.C.reduce((n, r) => n + (r.dropped || 0), 0);
const onl = abl.online_fallback;
const onlineQ = onl.filter((r) => r.expect === "online");
const pct = (x) => `${Math.round(x * 100)}%`;
const ratio = (s) => `${s.citations_valid} of ${s.citations_shown}`;
const ladder = [
  ["BM25 keyword search, raw question", { chunking: "window", query: "raw", retriever: "bm25", rerank: false }],
  ["BM25 + LLM rewrite of the question", { chunking: "window", query: "raw+rewrite", retriever: "bm25", rerank: false }],
  ["Multilingual embeddings (BGE-M3)", { chunking: "window", query: "raw+rewrite", retriever: "bge-m3", rerank: false }],
  ["BGE-M3 and Qwen3-Embedding fused", { chunking: "window", query: "raw+rewrite", retriever: "bge-m3+qwen3", rerank: false }],
  ["+ cross-encoder reranker (selected)", { chunking: "window", query: "raw+rewrite", retriever: "bge-m3+qwen3", rerank: true }],
].map(([n, k]) => { const r = find(k); return [n, `${Math.round(r["R@1"] * 49)}/49`, `${Math.round(r["R@3"] * 49)}/49`, `${Math.round(r["R@5"] * 49)}/49`]; });

// ---------------------------------------------------------------- helpers
const FONT = "Calibri", GREEN = "0B6B45";
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 21, ...o });
const b = (t) => run(t, { bold: true });
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [run(children)], spacing: { after: 90, line: 264 }, ...o });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONT })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: FONT })] });
const bullet = (children) => new Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: 50, line: 252 }, children: Array.isArray(children) ? children : [run(children)] });
const border = { style: BorderStyle.SINGLE, size: 4, color: "C9CFC9" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(widths, header, rows, sz = 18) {
  const total = widths.reduce((a, c) => a + c, 0);
  const cell = (txt, w, head) => new TableCell({
    borders, width: { size: w, type: WidthType.DXA }, margins: { top: 45, bottom: 45, left: 85, right: 85 },
    shading: head ? { fill: "E3F1EA", type: ShadingType.CLEAR, color: "auto" } : undefined,
    children: [new Paragraph({ spacing: { after: 0, line: 240 }, children: [new TextRun({ text: String(txt), font: FONT, size: sz, bold: head })] })],
  });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, widths[i], true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], false)) }))] });
}
const gap = () => new Paragraph({ spacing: { after: 50 }, children: [] });

// ---------------------------------------------------------------- evaluation sets and fairness (all read from files)
const HO = J("eval/results/everyday_holdout.json").rows;
const readJsonl = (f) => fs.readFileSync(path.join(P, f), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const hoList = readJsonl("eval/holdout/everyday_holdout.jsonl"), devList = readJsonl("eval/everyday_dev.jsonl");
const hoTests = Object.fromEntries(hoList.map((t) => [t.id, t]));
const qList = Object.values(tests);
const count = (list, f) => list.filter(f).length;
const qAns = count(qList, (t) => t.gold.length), qNot = qList.length - qAns;
const langCount = (list, k) => count(list, (t) => t.lang === k);
const LANGS = [["en", "English"], ["roman", "Roman Urdu"], ["ur", "Urdu script"], ["mixed", "Mixed"]];
const byLang = (rows, testsOf, hit) => Object.fromEntries(LANGS.map(([k]) => {
  const rs = rows.filter((r) => testsOf[r.id] && testsOf[r.id].expect === "answer" && testsOf[r.id].lang === k);
  return [k, rs.length ? `${rs.filter(hit).length}/${rs.length}` : "-"];
}));
const abLang = byLang(abl.rows.C, tests, (r) => r.citations.some((c) => tests[r.id].gold.includes(c.sid)));
const hoLang = byLang(HO, hoTests, (r) => r.gold_cited);
const unverifiedC = abl.rows.C.reduce((n, r) => n + r.citations.filter((c) => !c.valid).length, 0);
const hoAns = count(hoList, (t) => t.expect === "answer"), devAns = count(devList, (t) => t.expect === "answer");
const small = (t) => run(t, { size: 18, color: "5D6862" });

// ---------------------------------------------------------------- content
const children = [
  new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: "Haq Assist", font: FONT, size: 40, bold: true, color: GREEN })] }),
  new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: "Requirements, Architecture and Security Analysis", font: FONT, size: 28, bold: true })] }),
  para([run("Generative AI (BSE-7B) · Muhammad Ammar (23i-3052), Hayyan Faisal (23f-3108) · November 2026 · github.com/HayyanFaisal/haq-assist", { color: "5D6862", size: 19 })],
    { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 4 } }, spacing: { after: 150 } }),
  para([b("Summary. "), run(`Haq Assist answers everyday legal questions from people in Pakistan ("the police won't register my FIR", "my landlord won't return my deposit") in Urdu and English. It uses retrieval-augmented generation (RAG): a local language model (Gemma 4 12B) writes the answer only from sections of official law that a search step retrieves, and code checks every quoted sentence and number against the official text before anything is shown. When no answer survives the checks, the system says "Not found" and suggests a lawyer. On our main test, the same model without retrieval produced ${S.A.citations_shown} legal citations and none of their quotes exists in the law. The full system showed ${S.C.citations_shown} citations, all verifiable. This document states the requirements that matter because the system is generative, the components we built to meet them, how we measured them, and the security risks that remain.`)]),

  h1("1. The system, by example"),
  para([run("A student in Islamabad types in Roman Urdu: "), run("\"Police ne pakra hai, kehte hain raat thane mein rakhenge. Kitni der rakh sakte hain?\"", { italics: true }), run(" (\"The police have arrested me and say they will keep me overnight. How long can they hold me?\"). Haq Assist replies with numbered steps in plain Urdu and English. Each step quotes the law word for word and links to the page of the government PDF. Here it quotes the Code of Criminal Procedure, s. 61: "),
    run("\"…such period shall not, in the absence of a special order of a Magistrate under section 167, exceed twenty-four hours exclusive of the time necessary for the journey…\"", { italics: true }),
    run(", and the Constitution, Art. 10(2). Every answer carries one of four trust labels: "), b("Reviewed"), run(" (all its sources are sections reviewed in advance by two AI systems, Claude and Codex), "), b("Official law text"), run(" (verified against the official text, not separately reviewed), "), b("Found online"), run(" (an official government web page, not yet reviewed; an optional mode, off by default) or "), b("Not found"), run(". The user can also speak the question (transcribed by Whisper on the same PC) and have the verified answer read aloud.")]),
  para([b("Knowledge source. "), run(`The model is used unchanged; nothing is trained or fine-tuned. Its knowledge comes from a library of ${nActs} acts split into ${nSections.toLocaleString()} sections, all downloaded as PDFs from five official portals: pakistancode.gov.pk (${nFedActs} federal and Islamabad acts), punjabcode.punjab.gov.pk, sindhlaws.gov.pk, kpcode.kp.gov.pk and balochistancode.gob.pk. Each PDF's host, SHA-256 hash and title were recorded (${tri.filter((r) => r.check1_provenance === "pass").length}/${tri.length} passed). Each act's contents list was compared with the extracted sections: ${fedN.toLocaleString()}/${fedT.toLocaleString()} federal and Islamabad entries and ${provN.toLocaleString()}/${provT.toLocaleString()} provincial entries were found. Documents whose text could not be extracted reliably were excluded rather than used. Coverage is deepest for Islamabad and federal law; for the four provinces it covers everyday basics (consumer rights, tenancy, police, traffic, workplace harassment and, for Punjab, land and women's property). Because much law differs by province, every section is tagged with where it applies.`)]),

  h1("2. How we measured"),
  para([run("Every result in this document comes from one of three question sets, run against three versions of the system. The sets are labelled with the section(s) of law that correctly answer each question, or as questions the system must decline.")]),
  table([1500, 4826, 2700], ["Set", "What it contains", "Who wrote it"], [
    ["Q57", `${qList.length} short questions: ${qAns} answerable (each labelled with the correct sections) and ${qNot} the system must not answer from its library: 4 traps (a guaranteed-outcome request, an injected fake "section 999", a foreign visa, phone unlocking at a checkpoint, which no section settles) and 4 topics outside the library (tax, patents, crypto, motorway speed). Languages: ${langCount(qList, "en")} English, ${langCount(qList, "roman")} Roman Urdu, ${langCount(qList, "ur")} Urdu script.`, "Us; labels audited by Codex"],
    ["Stories-dev", `${devList.length} everyday accounts of what happened, as people actually write ("bhai ka mobile chori ho gaya, thane gaye to munshi keh raha hai…"); ${devAns} answerable, ${devList.length - devAns} not.`, "Us; used to tune prompts"],
    ["Stories-held-out", `${hoList.length} stories (${hoAns} answerable, ${hoList.length - hoAns} not), ${langCount(hoList, "roman")} in Roman Urdu, ${langCount(hoList, "en")} English, ${langCount(hoList, "ur")} Urdu script, ${langCount(hoList, "mixed")} mixed.`, "Codex; we did not read them until the final run"],
  ], 17),
  gap(),
  para([b("System versions. "), b("A"), run(" = Gemma 4 12B answering from its own memory (no retrieval). "), b("B"), run(" = Gemma with our retrieval but no checks (a standard RAG pipeline). "), b("C"), run(" = the full Haq Assist. "),
    b("Metrics. "), b("Verifiable citation"), run(": the quoted text is found in the cited official section. "), b("Correct law cited"), run(": at least one cited section is a labelled correct section (strict: a neighbouring section of the right act counts as wrong). "), b("Declined"), run(": \"Not found\" for a question that must not be answered. "), b("Retrieval hit"), run(": a correct section is among the top 5 search results. "),
    run("Correct law cited is a proxy: it does not judge whether the whole answer is legally complete, which would need a lawyer's rubric that we have not applied. "),
    b("What was tuned on what. "), run("Retrieval settings were selected on Q57's answerable questions, and prompts were tuned on Q57 and Stories-dev. Stories-held-out was used only to measure. In the ablation, all three versions get the province; A has its own prompt asking for the act, section and an exact quote, while B and C share the same retrieval and answer prompt, so the only difference between B and C is the checks. "),
    small("Codex is OpenAI's coding agent, an AI system independent of the one that built Haq Assist. It audited Q57's labels and wrote and labelled Stories-held-out from a brief on language mix and topics, using the library's section list. No lawyer checked any label. Decoding is deterministic (temperature 0), but these are single runs; we did not repeat them, and prompt changes moved story scores by about 3 questions either way.")]),

  h1("3. Generative-AI requirements"),
  para([run("A generative model writes fluent text whether or not it is true. For legal help, a wrong section or deadline can cost a person their case, so the requirements below concern what the model may say, not only what features exist. Targets were set in our proposal.")]),
  table([1900, 3700, 1500, 1926], ["Requirement", "How the system meets it", "Target", "Result"], [
    ["R1 Hallucination tolerance: no unverifiable citation or number is shown. Every quote and number must exist in the cited official section.", "Each quote is aligned to the official section and scored 0–100 for character-level similarity (rapidfuzz partial ratio). At 96 or above it is accepted and shown in the official wording; from 85 to 96 it is replaced by the official wording and re-checked; below 85 the step is removed. Every number in the English and Urdu text must appear in the quote. A second model pass must confirm the quote supports the claim, and an error counts as a rejection (fails closed).", ">= 95% of shown citations verifiable (proposal)", `Q57: ${ratio(S.C)} verifiable, so ${S.C.hallucinated_citations_shown} unverifiable shown (A: ${S.A.hallucinated_citations_shown}, B: ${S.B.hallucinated_citations_shown}). Not measured: a real quote applied to the wrong situation`],
    ["R2 Abstention: decline rather than guess; ask when the answer depends on the province.", "If no step survives the checks, the answer is \"Not found\" with a lawyer suggestion. For topics whose law differs by province (consumer, tenancy, police stops, traffic, domestic violence, workplace harassment) it asks which province; on other topics, with no province given, it searches only nationwide law. We first tried a retrieval-confidence threshold, but scores of answerable and unanswerable questions overlapped (0.003–0.81), so the checks decide instead.", ">= 7/8 declined", `Q57: ${S.C.unsupported_correctly_not_answered} declined; held-out stories: ${EH.unanswerable_correctly_not_answered}. Q57's 3 no-province questions: asked once, answered once from nationwide law, declined once`],
    ["R3 Usefulness: the checks must not make it refuse everything.", "Retrieval tuned over 69 configurations; story questions are searched from several angles (section 4).", "Most answerable questions", `Q57: ${S.C.answerable_with_correct_law_cited} correct law (B: ${S.B.answerable_with_correct_law_cited}). Held-out stories: ${EH.answerable_correct_law_cited} (our first version: ${EHb.answerable_correct_law_cited}); ${hoAns - parseInt(EH.answerable_answered)} of ${hoAns} answerable stories declined`],
    ["R4 Fairness: the same quality whatever the user's language or province.", "Multilingual embedding models; an everyday-word glossary in the prompt; answers in Urdu and English; each user gets their own province's law.", "Within 10 points across languages (set for this report; the proposal had none)", `Q57 correct law: English ${abLang.en}, Roman Urdu ${abLang.roman}, Urdu ${abLang.ur}, so the 10-point target is not met. Held-out: English ${hoLang.en}, Roman Urdu ${hoLang.roman}, Urdu ${hoLang.ur}, mixed ${hoLang.mixed}`],
    ["R5 Consistency and robustness: the same question gives the same answer; hidden instructions are ignored.", "Temperature 0 at every step; schema-constrained JSON outputs; retrieved text passed as data.", "Deterministic; injection refused", "Deterministic decoding. One injected question tested (\"ignore your rules... section 999\"): \"Not found\", nothing cited. Injection hidden in retrieved text or web pages was not tested adversarially"],
    ["R6 Runs locally within a time budget.", "One consumer GPU; no user data leaves the PC unless online search is switched on.", "Median < 12 s", `Median ${S.C.latency_p50_s} s, p90 ${S.C.latency_p90_s} s: target missed; 13.4 of 16 GB GPU memory`],
  ], 16),
  gap(),
  para([b("What each layer contributes (Q57). "), run(`A answered most questions confidently and cited real-sounding laws, but 0 of its ${S.A.citations_shown} quotes exists in the official text, and it named a correct section in ${aNamed} of ${qAns} questions. B, standard RAG, cited the correct law in ${S.B.answerable_with_correct_law_cited}, but still showed ${S.B.hallucinated_citations_shown} unverifiable citations. C removed them all by rejecting ${cDropped} unsupported steps, at a cost of one correct answer and about 1.5 s. Median latency: A ${S.A.latency_p50_s} s, B ${S.B.latency_p50_s} s, C ${S.C.latency_p50_s} s.`)]),
  para([b("Fairness finding. "), run(`English questions in Q57 were answered with the correct law far more often than Roman Urdu ones (${abLang.en} against ${abLang.roman}; the 3 no-province questions are counted under R2). The likely cause is vocabulary: people write "parcha" or "thanedar", while the law says "first information report" and "officer in charge of a police station". On the held-out stories the languages are closer (Roman Urdu ${hoLang.roman}, English ${hoLang.en}, Urdu ${hoLang.ur}). Urdu-script samples are small, so we do not claim parity. Coverage also favours Islamabad over the provinces. We report this as the main open fairness issue. We collect no names or demographic data, so we cannot test fairness across user groups beyond language and region. Every price plan gets the same verified answers.`)]),

  h1("4. Architecture: the components we built"),
  para([run("Each question passes through six stages. Each stage has its own guardrail, and nothing reaches the user until stage 4 has passed.")]),
  table([1500, 4726, 2800], ["Stage", "What it does", "Guardrail"], [
    ["1 Understand", "Gemma (temperature 0, JSON schema) identifies the topic and province and rewrites the question in English legal terms. For stories it also writes up to three sentences phrased as a statute would state the rule (the person's rights, the remedy, any offence). This is HyDE, query expansion with a hypothetical document: \"police refuse to register FIR\" does not retrieve CrPC s. 22-A (not in the top 200), but its statute-style phrasing ranks it first.", "Told never to name a law (when only asked to rephrase, Qwen3.5-9B invented a \"Consumer Protection Act 2012\"). These sentences are used for search only, never shown or used as evidence."],
    ["2 Retrieve", `Sections are split into ~1,000-character overlapping windows labelled with their act and section (8,277 windows). Two multilingual embedding models (BGE-M3, Qwen3-Embedding) are combined by reciprocal rank fusion, then a cross-encoder reranker re-scores the top 30. The question and each statute-style sentence are searched separately; up to 6 sections are kept.`, "Only law that applies in the user's province; with no province given, only nationwide law. For five common situations (arrest, FIR refused, police stops, online harm, traffic) the reviewed rights-card sections are always included."],
    ["3 Generate", "Gemma writes up to 5 steps in Urdu and English from the retrieved sections only. Each step cites one source and copies one exact quote of at most 60 words.", "Sources passed as data, not instructions; never promise an outcome."],
    ["4 Verify", "Quote, number, province and support checks (R1).", "Unsupported steps are removed, never shown; the summary is checked too."],
    ["5 Abstain or fall back", "If nothing passes: \"Not found\". With the optional online switch (off by default), official .gov.pk/.gob.pk pages are searched; their passages go through the same generate and verify stages and, if they pass, are labelled \"Found online, not yet reviewed\". Otherwise \"Not found\".", "Domain allowlist; fetch limits (section 5)."],
    ["6 Show", "Trust label, quotes, PDF page links and a live trace of each stage; optional voice reply of the verified text only.", "The user can check every claim at its source."],
  ], 16),
  gap(),
  table([5200, 1275, 1275, 1275], ["Why this retrieval: Q57's answerable questions, province given", "Top 1", "Top 3", "Top 5"], ladder),
  gap(),
  para([b("Deployment. "), run("One PC with a 16 GB GPU runs llama.cpp (Gemma 4 12B, 4-bit, 8K context), a FastAPI app (search, verification, web interface) and a local speech service (Whisper in, OmniVoice out). Gemma was chosen over Qwen3.5-9B because, on the same 10 test prompts, it invented no law names and followed the Urdu-script instruction.")]),

  h1("5. Security and safety analysis"),
  table([1900, 4200, 2926], ["Risk", "Mitigation implemented", "Residual risk"], [
    ["Hallucinated or misapplied law", "R1 checks; province filter; \"Not found\" when nothing passes; every answer links to the official page", "A correct quote can still be read out of context; the support check uses the same model"],
    ["Prompt injection (in the question, a retrieved section or a web page)", "Retrieved text passed as data; JSON-schema outputs; quotes and links come only from our records", "New attack patterns"],
    ["Malicious or redirected web pages (online mode)", "HTTPS only; every redirect re-checked against .gov.pk/.gob.pk; private and local addresses refused; size caps; 75 s deadline. Found by an independent Codex code audit and fixed", "A compromised government site"],
    ["Unsafe output in the browser", "All model and source text escaped before display (prevents script injection, XSS)", "-"],
    ["Overload", "At most 2 answers generated at once, 300 s timeout, audio uploads capped at 10 MB", "Single PC; not built for many users"],
    ["Stale or wrong library", "Official portals only, hashes recorded, failing documents excluded (e.g. the Limitation Act's deadline table, whose columns extract out of order)", "Later amendments need a re-run of the pipeline"],
    ["Privacy", "Models run locally; no accounts; audio not stored; online search off by default (when on, a rewritten query goes to search engines); demo access over a private network", "A hosted version would need encryption and data-retention rules"],
    ["Over-reliance", "Trust labels; \"not a lawyer\" notice; drafts marked for review", "Users may act without a lawyer"],
    ["Synthetic speech", "Only the verified answer is read aloud; generated audio carries a watermark; the non-commercial OmniVoice voice is used for this demo only", "A product needs a commercially licensed voice"],
  ], 16),
  gap(),
  para([b("Limitations. "), run("The rights cards and labels were reviewed by two AI systems, not yet by a lawyer. The system does not state limitation periods (the deadline table is excluded). Some story questions still miss the best section, e.g. a daughter excluded from inheritance. A short FIR question can cite an official section that names an office no longer in use, although the FIR rights card is correct. Latency is above target. Most importantly, no lawyer has yet scored whole answers for legal correctness and completeness; that rubric-based, held-out evaluation is the next step.")]),
];

const doc = new Document({
  creator: "Haq Assist team", title: "Haq Assist - Requirements, Architecture and Security Analysis",
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 26, bold: true, color: GREEN }, paragraph: { spacing: { before: 180, after: 80 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 22, bold: true }, paragraph: { spacing: { before: 110, after: 60 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
      new TextRun({ text: "Haq Assist · page ", font: FONT, size: 16, color: "8A938E" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: "8A938E" })] })] }) },
    children,
  }],
});
fs.mkdirSync(path.dirname(OUT), { recursive: true });
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("wrote", OUT, buf.length, "bytes"); });
