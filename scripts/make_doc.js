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

// ---------------------------------------------------------------- fairness: the same measures split by language
const HO = J("eval/results/everyday_holdout.json").rows;
const hoTests = Object.fromEntries(fs.readFileSync(path.join(P, "eval/holdout/everyday_holdout.jsonl"), "utf8").trim().split("\n").map((l) => { const t = JSON.parse(l); return [t.id, t]; }));
const LANGS = [["en", "English"], ["roman", "Roman Urdu"], ["ur", "Urdu script"], ["mixed", "Mixed"]];
const byLang = (rows, testsOf, hit) => Object.fromEntries(LANGS.map(([k]) => {
  const rs = rows.filter((r) => testsOf[r.id] && testsOf[r.id].expect === "answer" && testsOf[r.id].lang === k);
  return [k, rs.length ? `${rs.filter(hit).length}/${rs.length}` : "-"];
}));
const abLang = byLang(abl.rows.C, tests, (r) => r.citations.some((c) => tests[r.id].gold.includes(c.sid)));
const hoLang = byLang(HO, hoTests, (r) => r.gold_cited);
const unverifiedC = abl.rows.C.reduce((n, r) => n + r.citations.filter((c) => !c.valid).length, 0);

// ---------------------------------------------------------------- content
const children = [
  new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: "Haq Assist", font: FONT, size: 40, bold: true, color: GREEN })] }),
  new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: "Requirements, Architecture and Security Analysis", font: FONT, size: 28, bold: true })] }),
  para([run("Generative AI (BSE-7B) · Muhammad Ammar (23i-3052), Hayyan Faisal (23f-3108) · November 2026", { color: "5D6862", size: 19 })],
    { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 4 } }, spacing: { after: 150 } }),
  para([b("Haq Assist "), run(`helps people in Pakistan understand everyday legal problems. People ask in Urdu, Roman Urdu or English, typed or spoken. They get a plain answer in Urdu and English (read aloud on request), the excerpts of official law it relies on with a link to the government PDF page, or "Not found" when no answer passes its checks. It is a retrieval-augmented generation (RAG) system over ${nActs} official acts (${nSections.toLocaleString()} sections), running as local services on one PC. This document covers only the requirements that are specific to a generative system, and only the components we actually built.`)]),

  h1("1. Generative-AI requirements"),
  para([run("Each requirement has a target from our proposal, a measured result and the mechanism that enforces it. Measured on 57 labelled questions (49 answerable, 8 trick or outside the library) and on 40 everyday \"story\" questions that Codex, a different AI system, wrote and labelled. We did not read the 40 until the final run; one later change (rights-card pinning) was made after it.")]),
  table([1750, 3050, 1500, 2726], ["Requirement", "What it means here", "Target", "Measured"], [
    ["R1 Abstention", "If no retrieved excerpt supports an answer, say \"Not found\" and suggest a lawyer, rather than guess. Ask for the province when the law differs by province.", ">= 7/8 trick questions declined", `${S.C.unsupported_correctly_not_answered} (57-question set); ${EH.unanswerable_correctly_not_answered} (held-out stories)`],
    ["R2 Hallucination tolerance", "Zero tolerance for invented law. Every displayed citation must have an excerpt found in the cited official section. Every number in the English and Urdu text must appear in that excerpt.", ">= 95% verifiable; 0 unverifiable shown", `${ratio(S.C)} verifiable (${pct(S.C.citation_validity)}); ${S.C.hallucinated_citations_shown} unverifiable shown`],
    ["R3 Usefulness despite abstention", "The checks must not make the system useless: the right law should still be cited.", "Correct law on most answerable questions", `${S.C.answerable_with_correct_law_cited} correct law cited (no checks: ${S.B.answerable_with_correct_law_cited}); held-out stories ${EH.answerable_correct_law_cited}`],
    ["R4 Fairness across languages", "Urdu and Roman Urdu speakers should get the same quality as English speakers.", "No large gap", `57-question set: English ${abLang.en}, Roman Urdu ${abLang.roman}, Urdu ${abLang.ur}. Held-out: English ${hoLang.en}, Roman ${hoLang.roman}, Urdu ${hoLang.ur}, mixed ${hoLang.mixed}`],
    ["R5 Fairness across regions and plans", "Law is filtered to the user's province; with none given, only nationwide law. Every plan gets the same verified answers.", "No out-of-province law", "Region filter on every search; plans differ only in question count"],
    ["R6 Grounded retrieval", "The right section must reach the model, or it cannot answer correctly.", ">= 85% in the top 5", "48/49 selection experiment; 46/49 deployed (the 3 misses ask for the province first)"],
    ["R7 Consistency and robustness", "The same question gives the same answer. Instructions hidden in questions or web pages are ignored.", "Repeatable; injection refused", "Temperature 0 everywhere; injected \"section 999\" returned \"Not found\""],
    ["R8 Latency on one 16 GB GPU", "Usable on local hardware.", "Median < 12 s", `${S.C.latency_p50_s} s (p90 ${S.C.latency_p90_s} s): target missed, because each angle of a story is searched; 13.4 GB GPU`],
  ], 17),
  gap(),
  para([b("Fairness finding. "), run(`English questions did best. Roman Urdu was clearly weaker on the 57-question set (${abLang.roman} against ${abLang.en}). On the held-out stories the gap is smaller (Roman Urdu ${hoLang.roman}, English ${hoLang.en}, Urdu ${hoLang.ur}). Everyday words that differ from legal wording ("parcha", "thanedar") are the likely cause; the glossary and statute-style search sentences target them, but this remains our main fairness limitation. Urdu-script samples are small, so we do not claim parity there. Coverage is also uneven: Islamabad and federal law in depth, provinces basic. The app says so and asks for the province.`)]),

  h2("Evidence: what each layer contributes (57 questions)"),
  table([3900, 1700, 1700, 1726], ["Measure", "A: LLM alone", "B: + retrieval, no checks", "C: Haq Assist"], [
    ["Shown citations with a verifiable excerpt", ratio(S.A), ratio(S.B), ratio(S.C)],
    ["Unverifiable citations shown", ...["A", "B", "C"].map((c) => String(S[c].hallucinated_citations_shown))],
    ["Correct law cited", ...["A", "B", "C"].map((c) => S[c].answerable_with_correct_law_cited)],
    ["Trick/out-of-scope not answered", ...["A", "B", "C"].map((c) => S[c].unsupported_correctly_not_answered)],
    ["Median latency (s)", ...["A", "B", "C"].map((c) => String(S[c].latency_p50_s))],
  ]),
  gap(),
  para([run(`The same model (Gemma 4 12B) answering from memory produced ${S.A.citations_shown} citations, and none of their quotes was found in the official text. Retrieval alone still showed ${S.B.hallucinated_citations_shown} unverifiable citations. The checks removed them all (${unverifiedC} remain) by rejecting ${cDropped} unsupported steps, at a cost of one correct answer. On the held-out stories, the story-aware search raised correct law cited from ${EHb.answerable_correct_law_cited} to ${EH.answerable_correct_law_cited}. These are single runs, and LLM output varies by a few questions between runs.`)]),

  h1("2. Architecture: the components we built"),
  table([1600, 4626, 2800], ["Stage", "What it does", "Guardrail it provides"], [
    ["1 Understand", "Gemma 4 12B (temperature 0, JSON schema) detects topic and province, rewrites the question in legal English, and writes up to 3 statute-style search sentences (rights, remedy, offence): HyDE query expansion. An everyday-word glossary helps (thana, parcha, khula, wirasat).", "Told never to name a law: Qwen3.5-9B invented a \"Consumer Protection Act 2012\" when only rephrasing. Schema-validated output."],
    ["2 Retrieve", `~1,000-character windows with act and section headings. BGE-M3 + Qwen3-Embedding fused by reciprocal rank fusion, then the bge-reranker-v2-m3 cross-encoder over the top 30. The question and each sentence are searched separately; up to 6 sections kept. Chosen from ${retr.rows.length} measured configurations.`, "Region filter from each act's extent clause. Reviewed rights-card law pinned for FIR, arrest, stop and search, online harm and traffic."],
    ["3 Generate", "Writes Urdu and English steps only from the retrieved sections (temperature 0). Each step cites one source and one excerpt.", "Context-only prompt; sources passed as data, not instructions."],
    ["4 Verify", "Excerpt matched to the official text (fuzzy alignment: >= 96 accepted, 85-96 replaced by the official wording and re-checked). Numbers in English and Urdu (including Urdu digits and number words) must be in the excerpt. A second model pass confirms support and fails closed. The summary is shown only if it passes.", "Hallucination filter: unsupported steps are removed, never shown."],
    ["5 Abstain or fall back", "If nothing passes: \"Not found\" plus a lawyer suggestion. Optional switch (off by default): official .gov.pk/.gob.pk pages only, labelled \"not yet reviewed\".", "Abstention gate; domain allowlist."],
    ["6 Show", "Trust level (Reviewed / Official law text / Found online / Not found), excerpts, PDF page links, the live search trace. Voice: Whisper transcribes speech; OmniVoice reads only the verified answer.", "Transparency; users can check every source."],
  ], 17),
  gap(),
  table([5200, 1275, 1275, 1275], ["Why this retrieval (49 labelled questions, region given)", "Top 1", "Top 3", "Top 5"], ladder),
  gap(),
  para([b("Runs on: "), run("llama.cpp (Gemma 4 12B, 4-bit QAT, 8K context), the FastAPI app (search, verification, streaming), and VoiceStudio (Whisper large-v3-turbo, OmniVoice), all on one RTX 5070 Ti (13.4 of 16 GB). Question encoding runs on the CPU.")]),

  h1("3. Security and safety analysis"),
  table([1900, 4200, 2926], ["Risk", "Mitigation implemented", "Residual risk"], [
    ["Hallucinated or wrong law", "Answers only from retrieved official text; excerpt, number, region and support checks; verified summary; \"Not found\" when nothing passes", "An excerpt can be read out of context; the support check uses the same model; links let users check"],
    ["Prompt injection", "Retrieved and fetched text passed as data; JSON-schema outputs; every excerpt and link comes from our records; injected \"section 999\" returned \"Not found\"", "New attack patterns"],
    ["Malicious or redirected web pages", "HTTPS only; every redirect re-checked against .gov.pk/.gob.pk; private and loopback addresses refused; size caps; 75 s deadline (fixes from a Codex code audit)", "A compromised government site"],
    ["Unsafe output in the browser", "All model and source text escaped before display (XSS); numbers escaped too", "-"],
    ["Overload", "At most 2 streamed questions at once, 300 s timeout; audio upload capped at 10 MB", "Single PC; not built for many users"],
    ["Outdated or incomplete law", "Official portals only; SHA-256 and version dates; 57/57 provenance; failing documents excluded (e.g. the Limitation Act's deadline table)", "Later amendments: re-run the pipeline"],
    ["Privacy", "AI runs locally; no accounts; audio not stored; online search off by default (when on, a rewritten query goes to search providers); remote demo over a private Tailscale network", "Hosting would need encryption and retention rules"],
    ["Over-reliance", "Trust level on every answer; drafts marked for review; disclaimer: \"not a lawyer\"", "Users may act without a lawyer"],
    ["Licences and regulation", "Gemma Apache-2.0; embedders and reranker Apache-2.0/MIT; OmniVoice is non-commercial (CC-BY-NC), accepted for this class demo only, with the required credit, and its audio is watermarked. No lawyer referral fee (Bar Council Rules 1976, r. 136)", "A product needs a commercially licensed voice"],
  ], 17),
  gap(),
  para([b("Known limits: "), run("no verified answer for compelled phone unlocking at a checkpoint; no limitation periods (deadline table excluded); some long stories still miss the best section (e.g. a daughter excluded from inheritance); a short FIR question can cite an official section that names an office no longer in use (the FIR rights card is correct); prices are proposals and lawyer profiles are fictional.")]),
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
