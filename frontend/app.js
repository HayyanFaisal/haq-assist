/* Haq Assist - single-page app (no build step). Talks to the local FastAPI backend. */
"use strict";

/* ---------------------------------------------------------------- helpers */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// only http(s) links are ever rendered (no javascript: or data: URLs, whatever the server returns)
const safeUrl = (u) => { try { const x = new URL(String(u), location.href); return /^https?:$/.test(x.protocol) ? x.href : "#"; } catch { return "#"; } };
const memory = new Map();  // used when the browser refuses storage (private mode, blocked site data)
const store = {
  get(k, d) { try { const v = localStorage.getItem("haq." + k); return v === null ? (memory.has(k) ? memory.get(k) : d) : JSON.parse(v); } catch { return memory.has(k) ? memory.get(k) : d; } },
  set(k, v) { memory.set(k, v); try { localStorage.setItem("haq." + k, JSON.stringify(v)); } catch { /* kept in memory for this visit */ } },
};
const num = (x) => esc(Number.isFinite(Number(x)) ? Number(x).toLocaleString() : "0");  // numbers from the server, escaped at the sink
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLANS = [
  { id: "free", name: "Free", price: 0, limit: 8, features: ["Answers quoted word for word from the official law", "Reviewed rights cards that work without the AI", "Ask by voice in Urdu"] },
  { id: "go", name: "Haq Go", price: 149, limit: 40, features: ["Everything in Free", "Consumer complaint and legal-notice drafts", "Copy answers with their quotes and links"] },
  { id: "plus", name: "Haq Plus", price: 599, limit: 80, features: ["Everything in Go", "Official government websites searched when the library has no answer", "Send your case summary to a lawyer, with your consent"], planned: ["Send your case summary to a lawyer, with your consent"] },
  { id: "ultra", name: "Haq Ultra", price: 899, limit: 150, features: ["Everything in Plus", "Urdu voice replies", "Faster answers at busy times"], planned: ["Urdu voice replies", "Faster answers at busy times"] },
];
const REGION_NAMES = { ict: "Islamabad", punjab: "Punjab", sindh: "Sindh", kp: "Khyber Pakhtunkhwa", balochistan: "Balochistan" };
const LEVELS = {
  1: { en: "Reviewed", ur: "تصدیق شدہ", hint: "Every source is a section reviewed in advance." },
  2: { en: "Official law text", ur: "سرکاری قانونی متن", hint: "Quoted from the official PDF and checked word for word." },
  3: { en: "Found online, not yet reviewed", ur: "آن لائن سرکاری ذریعہ", hint: "From an official government website; not yet in our reviewed library." },
  4: { en: "Not found", ur: "نہیں ملا", hint: "Nothing could be proved, so Haq does not guess." },
};
const EXAMPLES = [
  "Thane wale FIR nahi kaat rahe, 2 din se chakkar laga raha hoon. Kya karun?",
  "Meri zameen chachu ne dhoke se apne naam karwa li, wapis kaise milegi?",
  "Dukandar ne kharab phone becha aur wapis nahi le raha. Kahan shikayat karoon?",
  "پولیس رات کو بھائی کو گھر سے لے گئی، کتنی دیر رکھ سکتی ہے؟",
];

const state = {
  lang: store.get("lang", "en"),
  region: store.get("region", "ict"),
  online: store.get("online", false),          // privacy-preserving default: the library on this computer only
  pipeline: store.get("pipeline", true),        // the live "how Haq works" view
  motionReduced: store.get("motionReduced", false),
  plan: store.get("plan", "free"),
  lastAnswer: null,
  cards: null,
  library: null,
  health: null,
  busy: false,
};
const reducedMotion = () => state.motionReduced || matchMedia("(prefers-reduced-motion: reduce)").matches;
const ur = () => state.lang === "ur";

const icon = {
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-6 16-3-7z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>',
  person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></svg>',
  dot: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/></svg>',
};
const CARD_ICONS = {
  arrest_24h: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
  fir_refused: '<svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5"/></svg>',
  online_harm: '<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  stop_search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>',
  traffic_challan: '<svg viewBox="0 0 24 24"><path d="M5 16V11l2-5h10l2 5v5zM5 16v3M19 16v3M5 11h14"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/></svg>',
};

function toast(msg, ms = 3800) {
  // a manual popover sits in the top layer, so the message shows even above an open dialog;
  // screen readers hear it through the page's live region (a hidden popover cannot announce)
  const el = $("#toast"); el.textContent = msg;
  if (el.showPopover) { try { el.hidePopover(); } catch { /* not open */ } el.showPopover(); }
  el.classList.add("show"); announce(msg);
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.classList.remove("show"); if (el.hidePopover) setTimeout(() => { try { el.hidePopover(); } catch { /* already closed */ } }, 260); }, ms);
}
function announce(msg) { const el = $("#announce"); el.textContent = ""; requestAnimationFrame(() => { el.textContent = msg; }); }
async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) { let d = ""; try { d = (await res.json()).detail; } catch { /* not JSON */ } throw new Error(d || `${res.status}`); }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? res.json() : res.blob();
}
// Pakistan Code marks some acts "(Under Review)"; the citation reads better without it, and the spacing is tidied
const actName = (act) => String(act || "").replace(/\s*\(Under Review\)/i, "").replace(/\s+,/g, ",").replace(/,(?=\S)/g, ", ").trim();
const shortAct = (act) => { const m = String(act || "").match(/\(([A-Za-z]{2,6})\)/); return m ? m[1] : String(act || "").replace(/,?\s*\d{4}.*$/, ""); };
const unit = (act) => /Constitution|Police Order|Qanun-e-Shahadat|Order, 19|Order, 20/i.test(act || "") ? "Article" : "section";

/* ---------------------------------------------------------------- plan and usage (demo: kept on this device) */
const monthKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
function usage() { let u = store.get("usage", null); if (!u || u.month !== monthKey()) { u = { month: monthKey(), used: 0 }; store.set("usage", u); } return u; }
const plan = () => PLANS.find((p) => p.id === state.plan) || PLANS[0];
const left = () => Math.max(0, plan().limit - usage().used);
function paintMeter() {
  const l = left(), lim = plan().limit;
  $("#meterText").textContent = `${l} left`;
  $("#meter").setAttribute("aria-label", `${l} of ${lim} questions left this month on ${plan().name}`);
  $("#meterFill").style.strokeDashoffset = String(100 - (l / lim) * 100);
  $("#meter").classList.toggle("low", l > 0 && l / lim <= 0.25);
  $("#meter").classList.toggle("empty", l === 0);
}
function spend() { const u = usage(); u.used += 1; store.set("usage", u); paintMeter(); }
function setPlan(id) {
  state.plan = id; store.set("plan", id); paintMeter(); syncSettings();
  if (/^#\/(plans|pricing)/.test(location.hash)) plans();
}

/* ---------------------------------------------------------------- dialogs */
function supportsTopLayerExit() {
  if (!window.CSS?.supports?.("overlay", "auto") || !CSS.supports("transition-behavior", "allow-discrete")) return false;
  const probe = document.createElement("div");
  probe.style.cssText = "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe); getComputedStyle(probe).display; probe.style.display = "none";
  const ok = getComputedStyle(probe).display === "block"; probe.remove(); return ok;
}
async function closeDialog(d) {
  if (!d.open) return;
  if (!supportsTopLayerExit()) {
    d.setAttribute("data-closing", "");
    const anims = d.getAnimations({ subtree: true });
    if (anims.length) await Promise.race([Promise.allSettled(anims.map((a) => a.finished)), sleep(400)]);
    d.removeAttribute("data-closing");
  }
  d.close();
}
for (const d of $$("dialog.sheet")) {
  d.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(d); });
}
function openModal(html, labelId = "modalTitle") {
  const m = $("#modal");
  m.setAttribute("aria-labelledby", labelId);
  m.innerHTML = `<div class="sheet-inner">${html}</div>`;
  m.showModal();
  $$("[data-close]", m).forEach((b) => b.addEventListener("click", () => closeDialog(m)));
  return m;
}
function openUpgrade() {
  const next = PLANS.filter((p) => p.limit > plan().limit);
  openModal(`<header class="sheet-head"><h1 id="modalTitle">You've used this month's questions</h1>
      <button class="icon-btn" data-close aria-label="Close">${icon.cross}</button></header>
    <p class="sub" style="color:var(--muted)">${esc(plan().name)} includes ${plan().limit} questions a month. Rights cards still work, and your questions reset on the 1st.</p>
    <div class="plan-pick">${next.map((p) => `<button class="btn ${p.id === "ultra" ? "gold" : "secondary"}" data-plan="${p.id}">${esc(p.name)}: ${p.limit} a month for Rs ${p.price}</button>`).join("")}</div>
    <p class="fine">Demo: switching plans is instant and free. A launch version would take payment through a local provider.</p>
    <a class="btn ghost small" href="#/plans" data-close>Compare plans</a>`);
  $$("[data-plan]", $("#modal")).forEach((b) => b.onclick = () => { setPlan(b.dataset.plan); closeDialog($("#modal")); toast(`Switched to ${plan().name}. You have ${left()} questions this month.`); });
}

/* ---------------------------------------------------------------- settings */
function syncSettings() {
  $("#setPipeline").checked = state.pipeline;
  $("#setOnline").checked = state.online;
  $("#setMotion").checked = state.motionReduced;
  $$("input[name=setLang]").forEach((r) => { r.checked = r.value === state.lang; });
  const pick = $("#planPick");
  if (!pick.childElementCount) {  // build once; later changes only update the checked radio, so keyboard focus stays put
    pick.innerHTML = PLANS.map((p) => `<label><input type="radio" name="setPlan" value="${esc(p.id)}">
      <strong>${esc(p.name)}</strong><span>${num(p.limit)} questions, Rs ${num(p.price)}${p.price ? " a month" : ""}</span></label>`).join("");
    $$("input[name=setPlan]", pick).forEach((r) => r.onchange = () => setPlan(r.value));
  }
  $$("input[name=setPlan]", pick).forEach((r) => { r.checked = r.value === state.plan; });
}
$("#settingsBtn").onclick = () => { syncSettings(); $("#settings").showModal(); };
$("#settings").addEventListener("submit", (e) => { e.preventDefault(); closeDialog($("#settings")); });
$("#setPipeline").onchange = (e) => { state.pipeline = e.target.checked; store.set("pipeline", state.pipeline); };
$("#setOnline").onchange = (e) => { setOnline(e.target.checked); };
$("#setMotion").onchange = (e) => { state.motionReduced = e.target.checked; store.set("motionReduced", state.motionReduced); applyMotion(); };
$$("input[name=setLang]").forEach((r) => r.onchange = () => { state.lang = r.value; store.set("lang", state.lang); if (state.lastAnswer && $("#answer")) renderAnswer(state.lastAnswer); });
$("#resetUsage").onclick = () => { store.set("usage", { month: monthKey(), used: 0 }); paintMeter(); if (/^#\/(plans|pricing)/.test(location.hash)) plans(); toast(`Questions reset: ${left()} left this month.`); };
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", applyMotion);  // follow the device setting live
function setOnline(on) {
  state.online = on; store.set("online", on);
  const chip = $("#onlineChip"); if (chip) paintOnlineChip(chip);
  toast(on ? "Official government websites will be searched when the library has no answer." : "Library only: answers come from the official documents on this computer.");
}
function applyMotion() {
  document.documentElement.dataset.motion = state.motionReduced ? "reduced" : "full";
  const logo = $(".stage-logo"); if (logo) logo.src = reducedMotion() ? "assets/logo-still.webp" : "assets/logo-anim.webp";
}

/* ---------------------------------------------------------------- router (view transitions between pages) */
const routes = { "": home, cards: cardsList, card: cardView, complaint, lawyers, plans, pricing: plans };
let firstRoute = true;
function route() {
  stopPlayback();  // leaving a page stops anything being read aloud
  const [, name = "", arg] = location.hash.split("/");
  const tab = name === "" ? "home" : name === "card" ? "cards" : name === "pricing" ? "plans" : name;
  $$(".nav a").forEach((a) => (a.dataset.tab === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  const render = () => { (routes[name] || home)(arg); if (!firstRoute) window.scrollTo({ top: 0 }); };
  const focus = () => { if (!firstRoute) $("#view").focus({ preventScroll: true }); firstRoute = false; };
  if (!firstRoute && document.startViewTransition && !reducedMotion()) {
    document.startViewTransition(render).finished.finally(focus);
  } else { render(); focus(); }
}
window.addEventListener("hashchange", route);

/* ---------------------------------------------------------------- home */
function home() {
  const n = num(state.library ? state.library.sections : 4716);
  $("#view").innerHTML = `
  <section class="hero">
    <div class="hero-copy">
      <h1 class="headline"><span class="hang" aria-hidden="true">“</span>Know your rights. Quoted from the law.</h1>
      <p class="headline-ur" lang="ur">اپنے حقوق جانیے، قانون کے اپنے الفاظ میں</p>
      <p class="lede">Ask in Urdu, Roman Urdu or English, or just describe what happened. Haq finds the law that applies, shows its exact words with a link to the official source, and tells you plainly when it can't prove an answer.</p>
      <form class="composer" id="askForm">
        <label for="q" class="visually-hidden">Your question, or what happened</label>
        <textarea id="q" dir="auto" rows="3" placeholder="Police ne pakra hai, kitni der rakh sakte hain?"></textarea>
        <div class="composer-bar">
          <span class="chip emerald" id="regionChip">${icon.pin}<span>${esc(REGION_NAMES[state.region])}</span></span>
          <button type="button" class="chip" id="onlineChip"></button>
          <span class="spacer"></span>
          <button type="button" class="icon-btn mic" id="micBtn" aria-label="Ask by voice">${icon.mic}</button>
          <button class="btn primary" id="askBtn" type="submit">${icon.send}<span>Ask Haq</span></button>
        </div>
      </form>
      <p class="composer-hint"><kbd>Enter</kbd> to ask, <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line</p>
      <div class="examples" role="group" aria-label="Try an example">
        ${EXAMPLES.map((e) => `<button type="button" class="chip" data-example="${esc(e)}"><span ${/[؀-ۿ]/.test(e) ? 'lang="ur"' : ""}>${esc(e)}</span></button>`).join("")}
      </div>
    </div>
    <aside class="stage" id="stage" aria-label="Haq at work">${stageRest(n)}</aside>
  </section>
  <div id="answer" class="answer-wrap"></div>

  <section aria-labelledby="flowTitle">
    <div class="section-head"><h2 id="flowTitle">How every answer is checked</h2>
      <p>The AI only explains. The law comes from official PDFs, and code checks every quote before you see it.</p></div>
    <ol class="flow">
      <li><span class="n">1</span><h3>Reads your question</h3><p>Gemma 4 works out what you need to know and where you are, in Urdu, Roman Urdu or English.</p></li>
      <li><span class="n">2</span><h3>Searches the law</h3><p>${n} sections of official law are searched, one angle at a time: your rights, the remedy, any offence.</p></li>
      <li><span class="n">3</span><h3>Writes from the law</h3><p>Every step must quote one section. Nothing comes from the model's memory.</p></li>
      <li><span class="n">4</span><h3>Checks every quote</h3><p>Word for word against the official text, every number, the province, then a second support check.</p></li>
      <li><span class="n">5</span><h3>Shows the proof</h3><p>The exact words with a link to the official source, or "Not found" when nothing can be proved.</p></li>
    </ol>
  </section>

  <section aria-labelledby="cardsTitle">
    <div class="section-head"><h2 id="cardsTitle">Rights cards for Islamabad</h2>
      <p>Reviewed in advance for the moments that can't wait. They open instantly and work without the AI.</p></div>
    <div class="cards-grid" id="cardTiles"></div>
  </section>

  <section aria-labelledby="libTitle">
    <div class="library">
      <div>
        <div class="section-head"><h2 id="libTitle">What's in the library</h2></div>
        <div class="ledger" id="ledger">
          <div><b>${n}</b><span>sections of law, each with its page in the official PDF</span></div>
          <div><b>${num(state.library ? state.library.acts : 54)}</b><span>acts: federal and Islamabad law in depth, the basics for every province</span></div>
          <div><b>57/57</b><span>PDFs traced to a .gov.pk or .gob.pk host and fingerprinted</span></div>
          <div><b>0</b><span>unverifiable citations among the 121 shown in our 57-question accuracy test</span></div>
        </div>
      </div>
      <ul class="areas" id="areas" aria-label="Sections by area of law"></ul>
    </div>
  </section>`;

  const form = $("#askForm"), q = $("#q");
  paintOnlineChip($("#onlineChip"));
  $("#onlineChip").onclick = () => setOnline(!state.online);
  form.onsubmit = (e) => { e.preventDefault(); const text = q.value.trim(); if (text) ask(text); else q.focus(); };
  q.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  $("#micBtn").onclick = recordVoice;
  $$("[data-example]").forEach((b) => b.onclick = () => { q.value = b.dataset.example; q.focus(); });
  renderCardTiles($("#cardTiles"));
  renderLibrary();
  if (state.lastAnswer) { renderAnswer(state.lastAnswer); if (state.lastAnswer._trace && state.pipeline) restoreTrace(state.lastAnswer); }
}
function stageRest(n) {
  const h = state.health;
  return `<div class="stage-rest">
    <img class="stage-logo" src="${reducedMotion() ? "assets/logo-still.webp" : "assets/logo-anim.webp"}" alt="Haq: scales of justice, your digital legal partner" width="480" height="480" fetchpriority="high">
    <div class="stage-status">
      <span class="chip"><i class="dot ${!h ? "" : h.llm !== "ok" ? "off" : ""}"></i>${!h ? "Connecting to Gemma 4…" : h.llm !== "ok" ? "AI offline" : "Gemma 4 ready"}</span>
      <span class="chip">${icon.book}${n} sections loaded</span>
    </div></div>`;
}
function paintOnlineChip(chip) {
  chip.setAttribute("aria-pressed", String(state.online));
  chip.className = "chip" + (state.online ? " gold" : "");
  chip.innerHTML = state.online ? `${icon.globe}<span>Library + official websites</span>` : `${icon.book}<span>Library only</span>`;
  chip.title = state.online ? "If the library can't answer, official .gov.pk sites are searched" : "Answers only from the official documents on this computer";
}
async function renderLibrary() {
  try {
    if (!state.library) state.library = await api("/api/library");
    const L = state.library, max = L.areas[0].sections;
    const el = $("#areas"); if (!el) return;
    el.innerHTML = L.areas.slice(0, 14).map((a) => `<li><span class="name">${esc(a.area)}</span><span class="track"><i style="--w:${esc((Number(a.sections) / max || 0).toFixed(3))}"></i></span><span class="num">${num(a.sections)}</span></li>`).join("");
  } catch { /* the home page still works without the library summary */ }
}

/* ---------------------------------------------------------------- ask: stream the real pipeline */
async function ask(question, region = state.region) {
  if (state.busy) { toast("Haq is still answering your last question."); return; }
  if (left() <= 0) { openUpgrade(); return; }
  state.busy = true;
  const online = state.online;  // the mode this question was asked in, even if the setting changes meanwhile
  const btn = $("#askBtn"); btn.disabled = true; btn.lastElementChild.textContent = "Working…";
  const stage = $("#stage");
  const trace = new Trace(stage, { live: true, visual: state.pipeline, question });
  const here = () => document.body.contains(stage);  // false once the reader has moved to another page
  let result = null;
  try {
    const swap = () => trace.mount();
    if (document.startViewTransition && !reducedMotion()) await document.startViewTransition(swap).updateCallbackDone; else swap();
    if (matchMedia("(max-width: 1080px)").matches) stage.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    const res = await fetch("/api/ask/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, region, online }) });
    if (!res.ok) { let d = ""; try { d = (await res.json()).detail; } catch { /* not JSON */ } throw new Error(d || `HTTP ${res.status}`); }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        const ev = JSON.parse(line);
        if (ev.type === "result") result = ev.data;
        else if (ev.type === "error") throw new Error(ev.detail);
        else trace.push(ev);
      }
    }
    if (buf.trim()) throw new Error("the answer stream ended mid-message");
    await trace.drain();
    if (!result) throw new Error("the answer stream ended early");
    result._question = question;
    result._online = online;
    result._trace = trace.events;
    result._seconds = trace.elapsed();
    state.lastAnswer = result;
    if (result.status !== "clarify") spend();
    if (!here()) { toast("Your answer is ready on the Ask page."); return; }  // kept for when the reader returns
    trace.finish(result);
    renderAnswer(result);
    announce(result.status === "answered" ? `Answer ready: ${LEVELS[result.level].en}` : result.status === "clarify" ? "Haq needs your province" : "No verified answer found");
    $("#answer")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  } catch (err) {
    trace.fail(err.message);
    if (here()) $("#answer").innerHTML = `<div class="callout warn" role="alert"><strong>Haq could not finish this answer.</strong> ${esc(err.message)}. Check that the Haq services are running (start_haq.ps1), then ask again.</div>`;
    else toast("Haq could not finish your last answer: " + err.message);
  } finally {
    state.busy = false;
    const b = $("#askBtn"); if (b) { b.disabled = false; b.lastElementChild.textContent = "Ask Haq"; }
  }
}

/* The live pipeline. Real events from the engine arrive in bursts; they are played back with a short minimum gap so
   each step can be followed. With "Show how Haq works" off, the same events drive a one-line status instead. */
const STAGES = [
  { id: "understand", title: "Reading your question", who: "Gemma 4" },
  { id: "search", title: "Searching the law", who: "two embedding models and a reranker" },
  { id: "compose", title: "Writing the answer from the law", who: "Gemma 4" },
  { id: "verify", title: "Checking every quote", who: "code checks, then a support check" },
  { id: "online", title: "Searching official government websites", who: ".gov.pk and .gob.pk only", optional: true },
  { id: "done", title: "Answer ready", who: "" },
];
const QUIET_TEXT = { understand: "Reading your question…", search: "Searching the law…", compose: "Writing the answer from the law…", verify: "Checking every quote…", online: "Searching official government websites…" };

class Trace {
  constructor(host, { live, visual, question }) {
    Object.assign(this, { host, live, visual, question, events: [], queue: [], t0: performance.now(), stages: {}, angles: {}, finished: false });
    this.gap = live && visual && !reducedMotion() ? 260 : 0;
  }
  elapsed() { return Math.round((performance.now() - this.t0) / 100) / 10; }
  mount() {
    if (!this.visual) {
      this.host.classList.remove("working-stage");
      this.host.innerHTML = `<div class="quiet"><img src="assets/logo-still.webp" alt="" width="170" height="170"><p class="now" id="quietNow">Reading your question…</p><div class="working" style="width:220px"></div><p class="meta">Turn on "Show how Haq works" in Settings to watch each step.</p></div>`;
      return;
    }
    if (this.host.classList.contains("stage")) {
      this.host.classList.add("working-stage");
      this.host.scrollTop = 0;
      const h = this.host;
      const intent = (up) => { this.userScrolled = up || h.scrollHeight - h.scrollTop - h.clientHeight > 140; };
      h.onwheel = (e) => intent(e.deltaY < 0);
      h.ontouchmove = () => intent(true);
    }
    this.host.innerHTML = `<div class="pipe-head"><img src="assets/logo-still.webp" alt="" width="54" height="54"><h2>${this.live ? "Haq is working" : "How this answer was found"}</h2><span class="clock" aria-hidden="true">0.0 s</span></div>
      <div class="pipe-wrap"><span class="pipe-progress" aria-hidden="true"></span><ol class="pipe">${STAGES.map((s) => `<li class="pstage" data-id="${s.id}" data-state="pending" ${s.optional ? "hidden" : ""}>
        <span class="node" aria-hidden="true">${icon.check}</span><h3>${esc(s.title)} ${s.who ? `<span class="who">${esc(s.who)}</span>` : ""}</h3><div class="body"></div></li>`).join("")}</ol></div>`;
    for (const li of $$(".pstage", this.host)) this.stages[li.dataset.id] = li;
    if (this.live) this.tick = setInterval(() => { const c = $(".clock", this.host); if (c) c.textContent = `${this.elapsed().toFixed(1)} s`; }, 100);
  }
  push(ev) { this.events.push(ev); this.queue.push(ev); if (!this.running) this.run(); }
  async run() {
    this.running = true;
    while (this.queue.length) {
      try { this.apply(this.queue.shift()); } catch (e) { console.error("pipeline view:", e); }  // never stall the answer
      if (this.gap) await sleep(this.gap);
    }
    this.running = false;
    if (this.waiter) { this.waiter(); this.waiter = null; }
  }
  drain() { return this.running || this.queue.length ? new Promise((r) => { this.waiter = r; }) : Promise.resolve(); }
  setStage(id) {
    const order = STAGES.map((s) => s.id);
    for (const s of order) {
      const li = this.stages[s]; if (!li) continue;
      if (s === id) { li.hidden = false; li.dataset.state = "active"; }
      else if (order.indexOf(s) < order.indexOf(id) && li.dataset.state === "active") li.dataset.state = "done";
    }
    const visible = order.filter((s) => this.stages[s] && !this.stages[s].hidden);
    const pp = $(".pipe-progress", this.host); if (pp) pp.style.setProperty("--p", Math.max(0, visible.indexOf(id) / (visible.length - 1)).toFixed(3));
  }
  body(id) { return $(".body", this.stages[id]); }
  add(id, html) { const b = this.body(id); if (!b) return null; b.insertAdjacentHTML("beforeend", html); this.follow(); return b.lastElementChild; }
  follow() {
    // keep the newest step in view inside the pipeline panel, unless the reader scrolled up to look at something
    if (!this.live || this.userScrolled || this.followQueued) return;
    this.followQueued = true;
    requestAnimationFrame(() => {  // one scroll per frame, after the new step is laid out
      this.followQueued = false;
      const h = this.host;
      if (h.scrollHeight > h.clientHeight) h.scrollTo({ top: h.scrollHeight, behavior: reducedMotion() ? "auto" : "smooth" });
    });
  }
  done(id, gold = false) { const li = this.stages[id]; if (li) { li.dataset.state = "done"; li.classList.toggle("gold", gold); } }
  apply(ev) {
    if (!this.visual) { if (ev.type === "stage" && QUIET_TEXT[ev.stage]) { const n = $("#quietNow"); if (n) n.textContent = QUIET_TEXT[ev.stage]; if (this.live) announce(QUIET_TEXT[ev.stage]); } return; }
    const A = this.live ? "enter" : "";
    switch (ev.type) {
      case "stage":
        if (ev.stage === "search") {
          this.done("understand");
          const areas = (state.library?.areas || []).slice(0, 16).map((a) => a.area);
          this.add("search", `<p class="pline">${num(ev.sections)} sections of official law, grouped by area:</p>`);
          this.add("search", `<div class="shelves" aria-hidden="true">${areas.map((a) => `<span class="shelf" data-area="${esc(a)}">${esc(a)}</span>`).join("")}</div>`);
        }
        if (ev.stage === "compose") { this.done("search"); this.add("compose", `<p class="pline ${A}">Writing only from the ${num(ev.sources)} sections found. Every step must quote one of them.</p><div class="working ${A}"></div>`); }
        if (ev.stage === "verify") this.done("compose");
        if (ev.stage === "online") { ["search", "compose", "verify"].forEach((s) => { const li = this.stages[s]; if (li && li.dataset.state !== "done") li.dataset.state = "skipped"; }); }
        this.setStage(ev.stage);
        if (this.live) announce(QUIET_TEXT[ev.stage] || "");
        break;
      case "understood":
        this.add("understand", `<div class="prow ${A}"><span class="chip emerald">${esc(ev.topic_label)}</span><span class="chip">${icon.pin}${esc(ev.region_name)}</span>${ev.angles?.length ? `<span class="chip">${num(ev.angles.length + 1)} searches planned</span>` : ""}</div>`);
        if (ev.rewrite) this.add("understand", `<p class="pline rewrite ${A}">${esc(ev.rewrite)}</p>`);
        break;
      case "searching": {
        const el = this.add("search", `<div class="angle ${ev.kind === "question" ? "whole" : ""} ${A}"><p class="q">${esc(ev.query)}</p><div class="working"></div></div>`);
        this.angles[ev.n] = el;
        break;
      }
      case "hits": {
        const el = this.angles[ev.n]; if (!el) break;
        $(".working", el)?.remove();
        el.insertAdjacentHTML("beforeend", `<div class="prow">${ev.hits.map((h) => hitChip(h, false, A)).join("")}</div>`);
        for (const h of ev.hits) this.light(h.area);
        break;
      }
      case "pinned":
        this.add("search", `<div class="angle ${A}" style="border-color:rgb(217 178 95 / .5)"><p class="pline"><strong style="color:var(--gold-hi)">Reviewed rights card:</strong> ${esc(ev.card)}. Its law is always included.</p><div class="prow">${ev.sections.map((h) => hitChip(h, true, A)).join("")}</div></div>`);
        for (const h of ev.sections) this.light(h.area, true);
        break;
      case "sources":
        this.add("search", `<p class="pline ${A}"><strong style="color:var(--text)">Chosen for the answer:</strong> ${num(ev.sources.length)} section${ev.sources.length === 1 ? "" : "s"} from ${num(new Set(ev.sources.map((s) => s.area)).size)} area${new Set(ev.sources.map((s) => s.area)).size === 1 ? "" : "s"} of law.</p>`);
        break;
      case "drafted":
        $(".working", this.body("compose"))?.remove();
        this.add("compose", ev.answerable ? `<p class="pline ${A}">Drafted ${num(ev.steps)} step${ev.steps === 1 ? "" : "s"}, each with a quote.</p>` : `<p class="pline ${A}">The sections found don't answer this, so nothing was drafted.</p>`);
        this.done("compose");
        break;
      case "supporting":
        this.add("verify", `<p class="pline ${A}">Quotes matched. Now a second pass checks each quote supports its claim in English and Urdu.</p>`);
        break;
      case "check": {
        const s = ev.source;
        const where = s ? `${esc(shortAct(s.act))} ${esc(s.section)}` : "A step";
        this.add("verify", ev.result === "verified"
          ? `<div class="check ok ${A}"><span class="mark">${icon.check}</span><div><span class="what">${where}</span> <span class="meta">${esc(s?.area || "")}</span><small>${ev.snapped ? "Close paraphrase replaced with the official wording, then verified" : "Verified word for word against the official text"}</small></div></div>`
          : `<div class="check drop ${A}"><span class="mark">${icon.cross}</span><div><span class="what">${where}</span><small>Removed: ${esc(ev.reason)}</small></div></div>`);
        break;
      }
      case "summary":
        this.add("verify", `<p class="pline ${A}">${ev.verified ? "Summary checked against the verified quotes." : "Summary rebuilt from the verified steps only."}</p>`);
        break;
      case "online_found":
        this.add("online", ev.pages?.length ? `<div class="prow ${A}">${ev.pages.map((p) => `<span class="chip gold">${icon.globe}${esc(p.domain || p.act)}</span>`).join("")}</div>` : `<p class="pline ${A}">No official page found.</p>`);
        this.done("online");
        break;
    }
  }
  light(area, gold = false) {
    let el = $$(".shelf", this.host).find((x) => x.dataset.area === area);
    if (!el) {  // a smaller area of law that isn't on the strip yet: add it as it lights up
      const strip = $(".shelves", this.host); if (!strip) return;
      strip.insertAdjacentHTML("beforeend", `<span class="shelf ${this.live ? "enter" : ""}" data-area="${esc(area)}">${esc(area)}</span>`);
      el = strip.lastElementChild;
    }
    el.classList.add("lit"); if (gold) el.classList.add("gold");
  }
  finish(r) {
    clearInterval(this.tick);
    if (!this.visual) { this.host.innerHTML = stageRest(num(state.library ? state.library.sections : 4716)); return; }
    const verified = r.status === "answered";
    if (r.status === "clarify") { this.done("understand"); }
    ["understand", "search", "compose", "verify", "online"].forEach((s) => { const li = this.stages[s]; if (li && li.dataset.state === "active") li.dataset.state = "done"; });
    if (this.stages.verify?.dataset.state === "done") this.stages.verify.classList.toggle("gold", verified);
    this.setStage("done");
    const lv = LEVELS[r.level] || null;
    this.add("done", r.status === "clarify"
      ? `<p class="pline ${this.live ? "enter" : ""}">This depends on the province. Choose one below.</p>`
      : `<p class="pline ${this.live ? "enter" : ""}"><strong style="color:${verified ? "var(--gold-hi)" : "var(--text)"}">${esc(lv?.en || "")}</strong> in ${(r._seconds ?? this.elapsed()).toFixed(1)} seconds.</p>`);
    this.done("done", verified);
    const clock = $(".clock", this.host); if (clock) clock.textContent = `${(r._seconds ?? this.elapsed()).toFixed(1)} s`;
    const pp = $(".pipe-progress", this.host); if (pp) pp.style.setProperty("--p", "1");
  }
  fail(msg) {
    clearInterval(this.tick);
    this.queue.length = 0;
    if (this.waiter) { this.waiter(); this.waiter = null; }
    $$(".working", this.host).forEach((w) => w.remove());
    if (!this.visual) { const n = $("#quietNow"); if (n) n.textContent = "Stopped: " + msg; return; }
    const active = Object.values(this.stages).find((li) => li.dataset.state === "active");
    if (active) { active.dataset.state = "skipped"; $(".body", active).insertAdjacentHTML("beforeend", `<p class="pline" style="color:var(--coral)">Stopped: ${esc(msg)}</p>`); }
  }
}
function hitChip(h, gold, cls) {
  const s = Math.max(0.04, Math.min(1, Number(h.score) || 0));
  return `<span class="hit ${gold ? "gold" : ""} ${cls}" title="${esc(h.act)}, ${esc(h.section)}: ${esc(h.title)}"><span class="area">${esc(h.area)}</span><span class="sec">${esc(shortAct(h.act))} ${esc(h.section)}</span>${h.score != null ? `<span class="bar" aria-hidden="true"><i style="--s:${s.toFixed(2)}"></i></span>` : ""}</span>`;
}
function restoreTrace(r) {
  const stage = $("#stage"); if (!stage) return;
  const t = new Trace(stage, { live: false, visual: true }); t.mount();
  for (const ev of r._trace) t.apply(ev);
  t.finish(r);
}
function traceHtml(r) {
  const box = document.createElement("div");
  const t = new Trace(box, { live: false, visual: true }); t.mount();
  for (const ev of r._trace || []) t.apply(ev);
  t.finish(r);
  $(".pipe-head", box)?.remove();
  return box.innerHTML;
}

/* ---------------------------------------------------------------- answer */
function renderAnswer(r) {
  const box = $("#answer"); if (!box) return;
  if (r.status === "clarify") {
    box.innerHTML = `<p class="qline"><q>${esc(r._question)}</q></p>
      <article class="answer"><p class="summary">${esc(r.question)}</p><p class="summary-ur" lang="ur">${esc(r.question_ur)}</p>
      <div class="actions">${Object.entries(r.options).map(([k, v]) => `<button class="btn secondary" data-region="${k}">${icon.pin}${esc(v)}</button>`).join("")}</div></article>`;
    $$("[data-region]", box).forEach((b) => b.onclick = () => { state.region = b.dataset.region; store.set("region", state.region); $("#region").value = state.region; paintRegion(); ask(r._question, state.region); });
    return;
  }
  const lv = LEVELS[r.level];
  const verified = r.status === "answered";
  const sumA = ur() ? r.summary_ur : r.summary_en, sumB = ur() ? r.summary_en : r.summary_ur;
  const steps = (r.steps || []).map((s) => `<li>
      <button class="step-no" data-ref="${num(s.ref)}" aria-label="Show source ${num(s.ref)}">${num(s.ref)}</button>
      <div>
        <p class="step-text" ${ur() ? 'lang="ur"' : ""}>${esc(ur() ? s.text_ur : s.text_en)}</p>
        <p class="step-ur" ${ur() ? "" : 'lang="ur"'}>${esc(ur() ? s.text_en : s.text_ur)}</p>
        <blockquote class="quote" lang="en">${esc(s.quote)}
          <cite>${esc(srcLabel(r, s.ref))}<a class="pdf-link" href="${esc(safeUrl(s.link))}" target="_blank" rel="noopener">${icon.pdf}${s.link && s.link.includes("pdf") ? "Official PDF" : "Official page"}${s.page ? `, page ${esc(s.page)}` : ""}</a></cite>
        </blockquote>
      </div></li>`).join("");
  const sources = (r.sources || []).map((s) => `<div class="source" id="src-${num(s.ref)}">
      <h4><span class="chip emerald">${num(s.ref)}</span>${esc(actName(s.act))}${s.section ? `, ${unit(s.act)} ${esc(s.section)}` : ""}${s.reviewed ? '<span class="chip gold">Reviewed</span>' : ""}</h4>
      ${s.title ? `<p class="meta">${esc(s.title)}</p>` : ""}
      <p class="meta">${s.origin === "online" ? `Fetched live from ${esc(s.domain)}` : "Official PDF"}${s.applies_in?.length ? `. Applies in ${esc(s.applies_in.map((x) => REGION_NAMES[x] || x).join(", "))}` : ""}${s.version_date ? `. Updated till ${esc(s.version_date)}` : ""}.</p>
      ${s.scope_note ? `<p class="meta">${esc(s.scope_note)}</p>` : ""}</div>`).join("");
  const dropped = r.checks?.dropped || [];
  const snapped = r.checks?.quotes_snapped || 0;
  box.innerHTML = `<p class="qline"><q>${esc(r._question)}</q><span class="chip">${icon.pin}${esc(r.region_name || "Not specified")}</span></p>
    <article class="answer ${verified && r.level <= 2 ? "verified" : ""}">
      <div class="answer-top">
        <span class="seal l${num(r.level)}" title="${esc(lv.hint)}"><i>${r.level <= 2 ? icon.check : r.level === 3 ? icon.globe : icon.cross}</i>${esc(ur() ? lv.ur : lv.en)}</span>
        ${r.confidence_band && verified ? `<span class="match" title="How closely the best section matched your question">${matchBars(r.confidence_band)} Search match: ${esc(r.confidence_band.toLowerCase())}</span>` : ""}
        ${r._seconds ? `<span class="meta">${r._seconds.toFixed(1)} seconds</span>` : ""}
        ${verified ? listenGroup("answer") : ""}
      </div>
      ${r.note && verified ? `<p class="callout warn">${esc(r.note)}</p>` : ""}
      <section class="answer-part" aria-labelledby="partAnswer">
        <h2 class="part-label" id="partAnswer">${verified ? "The answer" : "Result"}</h2>
        <p class="summary" ${ur() ? 'lang="ur"' : ""}>${esc(sumA || r.note)}</p>
        ${verified && sumB ? `<p class="summary-ur" ${ur() ? "" : 'lang="ur"'}>${esc(sumB)}</p>` : ""}
      </section>
      ${steps ? `<hr class="rule">
      <section class="answer-part" aria-labelledby="partLaw">
        <h2 class="part-label" id="partLaw">What the law says <span>Each step quotes the official text it relies on</span></h2>
        <ol class="steps">${steps}</ol>
      </section>` : ""}
      ${r.status === "not_found" ? `<div class="callout">Nothing in ${r._online ? "the library or on official government websites" : "the library on this computer"} could be proved for this question, so Haq won't guess.
          <div class="actions">${r._online ? "" : `<button class="btn secondary small" id="tryOnline">${icon.globe}Also search official websites</button>`}<a class="btn secondary small" href="#/lawyers">${icon.person}Talk to a lawyer</a></div></div>` : ""}
      ${r.card ? `<div class="callout card-link"><span class="chip gold">Reviewed rights card</span><strong>${esc(r.card.title_en)}</strong><span lang="ur">${esc(r.card.title_ur)}</span><a class="btn secondary small" href="#/card/${encodeURIComponent(r.card.id)}">Open the card</a></div>` : ""}
      ${sources ? `<details class="drawer" open><summary>Sources (${num(r.sources.length)})</summary><div class="inner">${sources}</div></details>` : ""}
      ${verified ? `<details class="drawer"><summary>How this answer was checked</summary><div class="inner"><ul class="checks-list">
        <li>Every quote shown is the official text, word for word.${snapped ? ` ${num(snapped)} close paraphrase${snapped > 1 ? "s were" : " was"} replaced with the official wording and checked again.` : ""}</li>
        <li>Every number (hours, days, amounts) appears in its quote, in English and in Urdu.</li>
        <li>Each law applies in ${esc(r.region_name)}.</li>
        <li>A second pass confirmed each quote supports its claim.</li>
        <li>${dropped.length ? `${num(dropped.length)} claim${dropped.length > 1 ? "s were" : " was"} removed: ${esc([...new Set(dropped.map((d) => d.reason))].join("; "))}.` : "No claims had to be removed."}</li></ul></div></details>` : ""}
      ${r._trace?.length ? `<details class="drawer trace"><summary>How this answer was found</summary><div class="inner">${traceHtml(r)}</div></details>` : ""}
      <div class="actions">
        <a class="btn secondary" href="#/lawyers">${icon.person}Find a lawyer</a>
        ${verified ? `<button class="btn ghost" id="copyBtn">${icon.copy}Copy with sources</button>` : ""}
      </div>
      <p class="disclaimer">${esc(r.disclaimer)}</p>
    </article>`;
  $$(".step-no", box).forEach((b) => b.onclick = () => { const el = $("#src-" + b.dataset.ref); if (el) { el.closest("details").open = true; el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" }); } });
  $("#tryOnline")?.addEventListener("click", () => { setOnline(true); ask(r._question, r.region || state.region); });
  wireListen(box, {
    en: [r.summary_en, ...(r.steps || []).map((s) => s.text_en)].join(" "),
    ur: [r.summary_ur, ...(r.steps || []).map((s) => s.text_ur)].join(" "),
  });
  $("#copyBtn")?.addEventListener("click", () => {
    const text = `${r.summary_en}\n\n${(r.steps || []).map((s) => `[${s.ref}] ${s.text_en}\n"${s.quote}"\n${safeUrl(s.link)}`).join("\n\n")}\n\n${r.disclaimer}`;
    navigator.clipboard.writeText(text).then(() => toast("Copied the answer with its quotes and links"), () => toast("Copy didn't work in this browser"));
  });
}
function srcLabel(r, ref) {
  const s = (r.sources || []).find((x) => x.ref === ref);
  return s ? `${actName(s.act)}${s.section ? `, ${unit(s.act)} ${s.section}` : ""}` : "";
}
function matchBars(band) {
  const n = { Low: 1, Medium: 2, High: 3 }[band] || 0;
  return `<span class="bars" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
}

/* ---------------------------------------------------------------- voice */
let recorder = null;
async function recordVoice() {
  const btn = $("#micBtn");
  if (recorder && recorder.state === "recording") { recorder.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = []; recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop()); btn.classList.remove("recording"); btn.setAttribute("aria-label", "Ask by voice");
      const fd = new FormData(); fd.append("audio", new Blob(chunks, { type: "audio/webm" }), "question.webm");
      toast("Transcribing on this computer…");
      try {
        const res = await fetch("/api/voice/transcribe", { method: "POST", body: fd });
        if (!res.ok) throw new Error((await res.json()).detail);
        const { text } = await res.json(); $("#q").value = text; $("#q").focus(); toast("Check the text, then press Enter");
      } catch (e) { toast("Voice input is unavailable: " + e.message); }
    };
    recorder.start(); btn.classList.add("recording"); btn.setAttribute("aria-label", "Stop recording"); toast("Recording. Tap the microphone again to stop.");
  } catch { toast("Microphone permission was not granted"); }
}
/* Read aloud: one English and one Urdu button, each a toggle (press again to stop). Starting one stops the other. */
const LISTEN = { en: { idle: "English", stop: "Stop", lang: "en" }, ur: { idle: "اردو", stop: "روکیں", lang: "ur" } };
let player = null;       // { audio, url, btn }
let speakToken = 0;      // a newer press supersedes a reply that is still being generated
function listenGroup(id) {
  if (!state.health?.voice_reply) return "";
  return `<div class="listen" role="group" aria-label="Listen to the ${id === "card" ? "card" : "answer"}">
    ${["en", "ur"].map((k) => `<button type="button" class="listen-btn" data-voice="${k}" aria-pressed="false" aria-label="${k === "en" ? "Listen in English" : "Listen in Urdu"}">
      <span class="ico" aria-hidden="true">${icon.speaker}</span><span class="lbl" ${k === "ur" ? 'lang="ur"' : ""}>${LISTEN[k].idle}</span></button>`).join("")}
  </div>`;
}
function wireListen(root, texts) {
  $$(".listen-btn", root).forEach((b) => b.addEventListener("click", () => speak(texts[b.dataset.voice], b, b.dataset.voice)));
}
function setListen(btn, mode) {  // idle | loading | playing
  const k = btn.dataset.voice;
  btn.dataset.state = mode;
  btn.setAttribute("aria-pressed", String(mode === "playing"));
  $(".ico", btn).innerHTML = mode === "playing" ? icon.stop : icon.speaker;
  $(".lbl", btn).textContent = mode === "playing" ? LISTEN[k].stop : mode === "loading" ? "…" : LISTEN[k].idle;
  btn.setAttribute("aria-label", mode === "playing" ? (k === "en" ? "Stop English audio" : "Stop Urdu audio") : mode === "loading" ? "Preparing audio" : (k === "en" ? "Listen in English" : "Listen in Urdu"));
}
function stopPlayback() {
  speakToken++;
  if (!player) { $$(".listen-btn[data-state='loading']").forEach((b) => setListen(b, "idle")); return; }
  player.audio.pause();
  URL.revokeObjectURL(player.url);
  if (player.btn.isConnected) setListen(player.btn, "idle");
  player = null;
  $$(".listen-btn[data-state='loading']").forEach((b) => setListen(b, "idle"));
}
async function speak(text, btn, voice = "ur") {
  if (!text) return;
  const busyHere = btn.dataset.state === "playing" || btn.dataset.state === "loading";
  stopPlayback();                       // any other reading stops
  if (busyHere) return;                 // pressing the same button again just stops it
  const token = ++speakToken;
  setListen(btn, "loading");
  try {
    const blob = await api("/api/voice/speak", { method: "POST", body: JSON.stringify({ text: text.slice(0, 1400), language: LISTEN[voice].lang }) });
    if (token !== speakToken) return;   // the reader pressed something else meanwhile
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    player = { audio, url, btn };
    audio.addEventListener("ended", () => { if (player?.audio === audio) stopPlayback(); }, { once: true });
    await audio.play();
    setListen(btn, "playing");
  } catch {
    if (token === speakToken) { setListen(btn, "idle"); toast("The voice couldn't play. Check that VoiceStudio is running, then try again.", 6000); }
  }
}

/* ---------------------------------------------------------------- rights cards */
async function loadCards() { if (!state.cards) state.cards = await api("/api/cards"); return state.cards; }
async function renderCardTiles(el) {
  try {
    const cards = await loadCards();
    el.innerHTML = cards.map((c) => `<a class="rcard" href="#/card/${encodeURIComponent(c.id)}"><span class="ico">${CARD_ICONS[c.id] || CARD_ICONS.fir_refused}</span>
      <strong>${esc(c.title_en)}</strong><span lang="ur">${esc(c.title_ur)}</span></a>`).join("");
  } catch { el.innerHTML = '<p class="meta">Rights cards are unavailable. Is the Haq backend running?</p>'; }
}
function cardsList() {
  $("#view").innerHTML = `<header class="page-head"><h1>Rights cards</h1>
      <p>For the moments that can't wait, in Islamabad. Every legal step quotes the official text, checked word for word and reviewed in advance. They open instantly and work without the AI.</p></header>
    <div class="cards-grid" id="cardTiles"></div>`;
  renderCardTiles($("#cardTiles"));
}
async function cardView(id) {
  let cards; try { cards = await loadCards(); } catch { $("#view").innerHTML = '<p class="callout warn">Rights cards are unavailable. Is the Haq backend running?</p>'; return; }
  const c = cards.find((x) => x.id === id);
  if (!c) { $("#view").innerHTML = `<header class="page-head"><h1>Card not found</h1><p><a href="#/cards">See all rights cards</a></p></header>`; return; }
  $("#view").innerHTML = `<article class="card-view">
    <header class="page-head"><p><a href="#/cards">All rights cards</a></p>
      <h1>${esc(c.title_en)}</h1><p lang="ur">${esc(c.title_ur)}</p>
      <div class="answer-top" style="margin-top:16px"><span class="seal l1"><i>${icon.check}</i>Reviewed</span><span class="chip">${icon.pin}Islamabad</span><span class="chip">Works without the AI</span>${listenGroup("card")}</div></header>
    <ol class="timeline">${c.steps.map((s, i) => `<li><span class="step-no" aria-hidden="true">${i + 1}</span><div>
      <span class="kind ${s.kind === "law" ? "" : "tip"}">${s.kind === "law" ? "The law" : "Safety tip, not a legal rule"}</span>
      <p class="step-text" ${ur() ? 'lang="ur"' : ""}>${esc(ur() ? s.text_ur : s.text_en)}</p>
      <p class="step-ur" ${ur() ? "" : 'lang="ur"'}>${esc(ur() ? s.text_en : s.text_ur)}</p>
      ${s.kind === "law" ? s.quotes.map((q) => `<blockquote class="quote" lang="en">${esc(q.text)}<cite>${esc(actName(s.act))}, ${unit(s.act)} ${esc(s.section)}<a class="pdf-link" href="${esc(safeUrl(q.link))}" target="_blank" rel="noopener">${icon.pdf}Official PDF, page ${esc(q.page)}</a></cite></blockquote>`).join("") : ""}
    </div></li>`).join("")}</ol>
    ${c.not_covered_en ? `<p class="callout">${esc(c.not_covered_en)}</p><p class="callout" lang="ur">${esc(c.not_covered_ur)}</p>` : ""}
    ${(c.links || []).map((l) => `<p style="margin-top:10px"><a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label)}</a></p>`).join("")}
    <div class="actions"><a class="btn secondary" href="#/lawyers">${icon.person}Find a lawyer</a></div>
  </article>`;
  wireListen($("#view"), { en: [c.title_en, ...c.steps.map((s) => s.text_en)].join(". "), ur: [c.title_ur, ...c.steps.map((s) => s.text_ur)].join("۔ ") });
}

/* ---------------------------------------------------------------- complaint */
let complaintFields = {};
let complaintRegion = "ict";
const FIELD_LABELS = { complainant_name: "Your name", complainant_address: "Your address", seller_name: "Seller or company",
  seller_address: "Seller's address", product_or_service: "Product or service", purchase_date: "Date of purchase",
  amount_paid: "Amount paid (Rs)", problem: "What is wrong", steps_taken: "What you did to resolve it", relief_wanted: "What you want: refund, replacement, repair or compensation" };
function complaint() {
  complaintRegion = state.region === "punjab" ? "punjab" : "ict";
  $("#view").innerHTML = `<header class="page-head"><h1>Consumer complaint</h1>
      <p>Tell Haq what happened. It fills in the form, you check it, and it drafts the documents the law requires where you bought it, quoting the exact sections.</p></header>
    <div class="wizard">
      <div class="panel">
        <h2>1. What happened</h2>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px">
          <span class="sub">Where did you buy it?</span>
          <div class="seg" id="regSeg"><button type="button" data-r="ict">Islamabad</button><button type="button" data-r="punjab">Punjab</button></div>
        </div>
        <label class="field-label" for="story">Your story, in Urdu, Roman Urdu or English</label>
        <textarea id="story" dir="auto" rows="5" placeholder="Maine 3 November ko Blue Area ki ABC Mobiles se 85,000 ka phone liya, 2 hafte mein screen kharab ho gayi, dukandar wapis nahi le raha."></textarea>
        <div class="actions"><button class="btn primary" id="extractBtn">Fill the form from my story</button></div>
        <div id="fieldsBox"></div>
      </div>
      <div class="panel" id="draftBox"><h2>2. Your documents</h2><p class="sub">Your drafts appear here with the sections they rely on. Empty fields stay as [blanks]; nothing is invented.</p></div>
    </div>`;
  const seg = $("#regSeg");
  const paint = () => $$("button", seg).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.r === complaintRegion)));
  seg.onclick = (e) => { const r = e.target.closest("button")?.dataset.r; if (!r) return; complaintRegion = r; paint(); if ($("#draftBox").dataset.ready) makeDraft(); };
  paint();
  $("#extractBtn").onclick = async () => {
    const story = $("#story").value.trim(); if (story.length < 5) { toast("Describe what happened first"); $("#story").focus(); return; }
    const b = $("#extractBtn"); b.disabled = true; b.textContent = "Reading your story…";
    try { complaintFields = await api("/api/complaint/extract", { method: "POST", body: JSON.stringify({ story }) }); renderFields(); }
    catch (e) { toast("Couldn't read the story: " + e.message); }
    finally { b.disabled = false; b.textContent = "Fill the form from my story"; }
  };
  if (Object.keys(complaintFields).length) renderFields();
}
function renderFields() {
  $("#fieldsBox").innerHTML = `<div class="two">${Object.entries(FIELD_LABELS).map(([k, label]) => `<div><label class="field-label" for="f_${k}">${label}</label>
    ${k === "problem" || k === "steps_taken" ? `<textarea id="f_${k}" data-k="${k}" rows="3">${esc(complaintFields[k] || "")}</textarea>` : `<input id="f_${k}" data-k="${k}" value="${esc(complaintFields[k] || "")}">`}</div>`).join("")}</div>
    <div class="actions"><button class="btn primary" id="draftBtn">Draft my documents</button></div>`;
  $$("[data-k]", $("#fieldsBox")).forEach((el) => el.oninput = () => { complaintFields[el.dataset.k] = el.value; });
  $("#draftBtn").onclick = makeDraft;
}
async function makeDraft() {
  const box = $("#draftBox");
  try {
    const d = await api("/api/complaint/draft", { method: "POST", body: JSON.stringify({ fields: complaintFields, region: complaintRegion }) });
    box.dataset.ready = "1";
    box.innerHTML = `<h2>2. Your documents</h2>
      <div class="answer-top" style="margin-top:10px"><span class="seal l1"><i>${icon.check}</i>Reviewed legal basis</span><span class="chip">${complaintRegion === "ict" ? "Islamabad Consumers Protection Act 1995" : "Punjab Consumer Protection Act 2005"}</span></div>
      ${d.legal_basis.map((b) => `<div style="margin:14px 0"><p>${esc(b.plain)}</p><blockquote class="quote" lang="en">${esc(b.quote)}<cite>${esc(actName(b.act))}, ${unit(b.act)} ${esc(b.section)}<a class="pdf-link" href="${esc(safeUrl(b.link))}" target="_blank" rel="noopener">${icon.pdf}Official PDF, page ${esc(b.page)}</a></cite></blockquote></div>`).join("")}
      <h3 style="margin:18px 0 8px">Next steps</h3><ol>${d.next_steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      ${d.documents.map((doc, i) => `<h3 style="margin:22px 0 10px">${esc(doc.title)}</h3><pre class="doc" id="doc${i}">${esc(doc.text)}</pre>
        <div class="actions"><button class="btn secondary small" data-copy="${i}">${icon.copy}Copy</button><button class="btn secondary small" data-print>Print or save as PDF</button></div>`).join("")}
      <p class="callout warn" style="margin-top:16px">${esc(d.warning)}</p>`;
    $$("[data-copy]", box).forEach((b) => b.onclick = () => navigator.clipboard.writeText($("#doc" + b.dataset.copy).textContent).then(() => toast("Copied")));
    $$("[data-print]", box).forEach((b) => b.onclick = () => window.print());
    box.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  } catch (e) { toast("Couldn't draft the documents: " + e.message); }
}

/* ---------------------------------------------------------------- lawyers */
async function lawyers() {
  $("#view").innerHTML = `<header class="page-head"><h1>Find a lawyer</h1>
      <p>Lawyers are listed free and pay nothing for clients: the Bar Council rules (Pakistan Legal Practitioners and Bar Councils Rules 1976, rules 135 and 136) forbid referral fees.</p></header>
    <p class="callout warn" style="margin-bottom:18px"><strong>Demo profiles.</strong> Every lawyer here is fictional. A launch version lists only verified advocates, showing just the details the Bar Council rules allow.</p>
    <div class="filters">
      <label>City<select id="fCity"><option value="">All cities</option>${["Islamabad", "Rawalpindi", "Lahore", "Karachi", "Peshawar"].map((c) => `<option>${c}</option>`).join("")}</select></label>
      <label>Practice area<select id="fArea"><option value="">All areas</option>${["Criminal", "Consumer", "Tenancy", "Property", "Family", "Cyber crime (PECA)", "Workplace harassment", "Domestic violence", "Civil", "Bail"].map((a) => `<option>${a}</option>`).join("")}</select></label>
    </div>
    <div class="lawyers" id="lawyerList"></div>`;
  const load = async () => {
    const q = new URLSearchParams(); if ($("#fCity").value) q.set("city", $("#fCity").value); if ($("#fArea").value) q.set("area", $("#fArea").value);
    let rows; try { rows = await api("/api/lawyers?" + q); } catch { $("#lawyerList").innerHTML = '<p class="meta">The directory is unavailable. Is the Haq backend running?</p>'; return; }
    $("#lawyerList").innerHTML = rows.length ? rows.map((l) => {
      const h = [...l.name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
      return `<article class="lawyer"><div class="avatar" style="--h1:hsl(${h} 45% 32%);--h2:hsl(${(h + 60) % 360} 50% 26%)">${esc(l.name[0])}</div><div>
        <h3>Adv. ${esc(l.name)} <span class="demo">Demo profile</span></h3>
        <p class="meta">${esc(l.standing)}, ${esc(l.years)} years. ${esc(l.qualifications)}. ${esc(l.city)}.</p>
        <div class="areas-row">${l.practice_areas.map((a) => `<span class="chip">${esc(a)}</span>`).join("")}</div>
        <p class="meta">Speaks ${esc(l.languages.join(", "))}. Consultation Rs ${num(l.consultation_fee_pkr[0])} to ${num(l.consultation_fee_pkr[1])}.</p>
        <p class="meta"><span class="stars" aria-hidden="true">${"★".repeat(Math.max(0, Math.min(5, Math.round(Number(l.rating) || 0))))}</span> ${esc(l.rating)} from ${esc(l.reviews)} reviews after booked consultations (a concept, subject to Bar Council clearance)</p>
        <div class="actions"><button class="btn secondary small" data-id="${esc(l.id)}">Send my case summary</button></div></div></article>`;
    }).join("") : '<p class="meta">No lawyers match these filters.</p>';
    $$("[data-id]", $("#lawyerList")).forEach((b) => b.onclick = () => sendSummary(rows.find((x) => x.id === b.dataset.id)));
  };
  $("#fCity").onchange = load; $("#fArea").onchange = load;
  $("#fCity").value = { ict: "Islamabad", punjab: "Lahore", sindh: "Karachi", kp: "Peshawar" }[state.region] || "";
  load();
}
function sendSummary(l) {
  const a = state.lastAnswer;
  const summary = a && a.status === "answered" ? `Question: ${a._question}\n\nWhat Haq Assist found:\n${a.summary_en}\n\nSources:\n${a.sources.map((s) => `- ${actName(s.act)}, ${unit(s.act)} ${s.section}`).join("\n")}`
    : "Ask a question first. Your question and the sections Haq found will be attached here.";
  const m = openModal(`<header class="sheet-head"><h1 id="modalTitle">Send your case summary</h1><button class="icon-btn" data-close aria-label="Close">${icon.cross}</button></header>
    <p style="color:var(--muted)">To Adv. ${esc(l.name)} <span class="demo">Demo profile</span></p>
    <pre class="doc">${esc(summary)}</pre>
    <div class="setting"><div class="setting-text"><label for="consent"><strong>I agree to share this summary with this lawyer</strong></label><span id="consentDesc">Nothing is sent without your consent.</span></div><input type="checkbox" switch role="switch" id="consent" aria-describedby="consentDesc"></div>
    <div class="actions"><button class="btn primary" id="sendNow" disabled>Send summary</button><button class="btn ghost" data-close>Cancel</button></div>`);
  $("#consent", m).onchange = (e) => { $("#sendNow", m).disabled = !e.target.checked; };
  $("#sendNow", m).onclick = () => { closeDialog(m); toast("Demo: summary marked as sent. In the product it goes only to this lawyer, with your consent."); };
}

/* ---------------------------------------------------------------- plans */
function plans() {
  const used = usage().used;
  $("#view").innerHTML = `<header class="page-head"><h1>Plans</h1>
      <p>Every plan gets the same verified answers: the law's exact words, checked against the official PDF. Plans differ in how many questions you can ask each month.</p></header>
    <div class="plans">${PLANS.map((p) => `<article class="plan ${p.id} ${p.id === state.plan ? "is-current" : ""}">
        ${p.id === state.plan ? '<span class="chip emerald current">Your plan</span>' : ""}
        <h2>${esc(p.name)}</h2>
        <div class="price"><b>Rs ${p.price}</b><span>${p.price ? "a month" : "always"}</span></div>
        <div class="quota"><b>${p.limit}</b><span>questions a month</span></div>
        <ul>${p.features.map((f) => `<li class="${f.startsWith("Everything") ? "more" : ""}">${icon.check}<span>${esc(f)}${p.planned?.includes(f) ? ' <span class="demo">Planned</span>' : ""}</span></li>`).join("")}</ul>
        ${p.id === state.plan ? `<button class="btn ghost" disabled>${used} of ${p.limit} used this month</button>` : `<button class="btn ${p.id === "ultra" ? "gold" : p.price ? "primary" : "secondary"}" data-plan="${p.id}">${p.price ? `Choose ${esc(p.name)}` : "Switch to Free"}</button>`}
      </article>`).join("")}</div>
    <p class="fine">Prices in Pakistani rupees, proposed for launch. This demo takes no payment: choosing a plan switches it instantly on this device, and only the question limit changes. Rights cards are free on every plan. Lawyers are listed free and pay nothing for clients (Bar Council rules 135 and 136).</p>
    <section aria-labelledby="orgTitle"><div class="section-head"><h2 id="orgTitle">For legal-aid groups and universities</h2>
      <p>Legal-aid societies, NGOs, university legal clinics and HR teams can run Haq on their own server, so data stays with them. Planned: licensed per organisation.</p></div></section>`;
  $$("[data-plan]").forEach((b) => b.onclick = () => { setPlan(b.dataset.plan); toast(`Switched to ${plan().name}: ${left()} questions left this month.`); });
}

/* ---------------------------------------------------------------- boot */
function paintRegion() { const c = $("#regionChip span"); if (c) c.textContent = REGION_NAMES[state.region]; }
$("#region").value = state.region;
$("#region").onchange = (e) => { state.region = e.target.value; store.set("region", state.region); paintRegion(); toast(`Answers now use the law for ${REGION_NAMES[state.region]}.`); };
applyMotion();
paintMeter();
route();
// The services start at different speeds (VoiceStudio takes ~20 s), so keep checking until the AI and voice are both up.
let healthTries = 0, firstHealth = true;
function checkHealth() {
  Promise.allSettled([api("/api/health"), state.library ? Promise.resolve(state.library) : api("/api/library")]).then(([h, l]) => {
    const hadVoice = !!state.health?.voice_reply;
    if (h.status === "fulfilled") state.health = h.value;
    if (l.status === "fulfilled") state.library = l.value;
    const L = state.library, H = state.health;
    $("#libraryLine").textContent = L ? `Library: ${L.sections.toLocaleString()} sections from ${L.acts} official acts, from Pakistan Code and provincial .gov.pk portals. AI ${H && H.llm === "ok" ? "online" : "starting or offline"}, voice ${H && H.voice === "ok" ? "online" : "starting or offline"}.` : $("#libraryLine").textContent;
    const voiceNow = !!H?.voice_reply;
    // voice just became available: add the Listen buttons to what is already on screen (no page transition)
    if (voiceNow && !hadVoice) {
      if (/^#\/card\//.test(location.hash) && !$(".listen")) cardView(location.hash.split("/")[2]);
      if ((location.hash === "" || location.hash === "#/") && state.lastAnswer && !state.busy) renderAnswer(state.lastAnswer);
      if (!firstHealth) toast("Voice is ready: you can now listen to answers.");
    }
    if (firstHealth && (location.hash === "" || location.hash === "#/")) {
      renderLibrary();
      const stage = $("#stage"); if (stage && !state.busy && !state.lastAnswer) stage.innerHTML = stageRest(num(L ? L.sections : 4716));
    }
    firstHealth = false;
    const ready = H && H.llm === "ok" && H.voice === "ok" && voiceNow;
    if (!ready && ++healthTries < 60) setTimeout(checkHealth, 5000);  // up to 5 minutes
  });
}
checkHealth();
