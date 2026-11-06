// Numbering matches the class worksheet.
const NUMS = [null,
  "Oklahoma", "New Mexico", "California", "Wisconsin", "South Dakota",
  "Colorado", "West Virginia", "Maine", "Florida", "Missouri",
  "Utah", "Washington", "Tennessee", "Minnesota", "Indiana",
  "Montana", "Kansas", "Massachusetts", "Iowa", "Alaska",
  "Mississippi", "Texas", "Maryland", "Pennsylvania", "Hawaii",
  "Vermont", "Idaho", "Georgia", "Rhode Island", "Nebraska",
  "Illinois", "New Jersey", "New Hampshire", "Delaware", "Louisiana",
  "New York", "Connecticut", "Nevada", "South Carolina", "Alabama",
  "Arkansas", "Kentucky", "Virginia", "Wyoming", "Michigan",
  "Ohio", "Arizona", "North Carolina", "North Dakota", "Oregon",
];
const NUM_OF = Object.fromEntries(NUMS.map((s, i) => [s, i]).filter(([s]) => s));
const BANK = NUMS.slice(1).sort();

const QUESTIONS = [
  { q: "Which two (2) states border Canada and the Pacific Ocean?", answer: "Washington and Alaska",
    ok: t => t.includes("washington") && t.includes("alaska") },
  { q: "What is the largest state?", answer: "Alaska", ok: t => t === "alaska" },
  { q: "What is the smallest state?", answer: "Rhode Island", ok: t => t === "rhodeisland" },
];

const REGION = {};
const regions = {
  west: "Washington|Oregon|California|Nevada|Alaska|Hawaii",
  mtn: "Montana|Idaho|Wyoming|Utah|Colorado",
  south: "Arizona|New Mexico|Texas|Oklahoma",
  plains: "North Dakota|South Dakota|Nebraska|Kansas",
  mid: "Minnesota|Iowa|Missouri|Wisconsin|Illinois|Indiana|Michigan|Ohio",
  se: "Arkansas|Louisiana|Mississippi|Alabama|Tennessee|Kentucky|Georgia|Florida|South Carolina|North Carolina|Virginia|West Virginia",
  midatl: "New York|New Jersey|Pennsylvania|Delaware|Maryland",
  ne: "Maine|New Hampshire|Vermont|Massachusetts|Rhode Island|Connecticut",
};
for (const [r, list] of Object.entries(regions)) list.split("|").forEach(n => (REGION[n] = r));

// Labels for small states sit off to the side with a leader line, like the worksheet.
const CALLOUT = {
  "Vermont": [848, 92], "New Hampshire": [884, 58],
  "Massachusetts": [948, 150], "Rhode Island": [948, 176], "Connecticut": [948, 202],
  "New Jersey": [948, 228], "Delaware": [948, 254], "Maryland": [948, 280],
};
const NUDGE = { "Michigan": [688, 196], "Florida": [790, 520], "Louisiana": [566, 470], "Hawaii": [300, 548], "Kentucky": [700, 318], "West Virginia": [764, 288] };

const SVGNS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, parent) => {
  const e = tag.startsWith("svg:") ? document.createElementNS(SVGNS, tag.slice(4)) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") e.textContent = v; else e.setAttribute(k, v);
  }
  if (parent) parent.appendChild(e);
  return e;
};
const norm = s => (s || "").toLowerCase().replace(/[^a-z]/g, "");

function buildMap(container, interactive) {
  const svg = el("svg:svg", { viewBox: "-10 30 985 580", class: "map-svg", role: "img", "aria-label": "Map of the United States with numbered states" });
  const gs = el("svg:g", {}, svg), gl = el("svg:g", {}, svg);
  for (let n = 1; n <= 50; n++) {
    const name = NUMS[n], shape = STATE_SHAPES[name];
    el("svg:path", { d: shape.d, class: `st r-${REGION[name]}`, "data-n": n }, gs);
    let [x, y] = NUDGE[name] || shape.c;
    if (CALLOUT[name]) {
      const [lx, ly] = CALLOUT[name];
      el("svg:line", { x1: shape.c[0], y1: shape.c[1], x2: lx - 12, y2: ly, class: "lead" }, gl);
      [x, y] = [lx, ly];
    }
    el("svg:circle", { cx: x, cy: y, r: 12, class: "num-bg" }, gl);
    el("svg:text", { x, y, class: "num", text: n }, gl);
  }
  container.appendChild(svg);
  return svg;
}

/* ---------------- state ---------------- */
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("states50:" + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("states50:" + k, JSON.stringify(v)); } catch {} },
};
let mode = store.get("mode", "drag");
let placed = store.get("placed", {});   // drag: { n: name }
let typed = store.get("typed", {});     // fill: { n: text }
let qans = store.get("qans", ["", "", ""]);
let selected = null;                    // tap-to-place: { name, from: "bank" | n }
let checked = false;

const $ = s => document.querySelector(s);
const mapSvg = buildMap($("#map"), true);
const slotsEl = $("#slots"), bankEl = $("#bank");

/* ---------------- countdown ---------------- */
(() => {
  const quiz = new Date(2026, 10, 12), now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Math.round((quiz - now) / 864e5);
  $("#countdown").textContent =
    days > 1 ? `Quiz on Thursday, Nov 12 — ${days} days to go!` :
    days === 1 ? "Quiz is tomorrow! You've got this." :
    days === 0 ? "Quiz day! Good luck! 🍀" : "Keep practicing — you know your states!";
})();

/* ---------------- rendering ---------------- */
function render() {
  document.body.className = "mode-" + mode;
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.mode === mode));
  $("#practice").hidden = mode === "print";
  $("#printPanel").hidden = mode !== "print";
  if (mode === "print") return renderSheet(false);
  $("#bankHint").textContent = mode === "drag" ? "Drag a name to its number (or tap a name, then tap a box)" : "Type each name — the bank crosses them off";
  $("#mapHint").textContent = mode === "drag" ? "Tip: you can also drop a name right onto the map." : "Tip: tap a state on the map to jump to its box.";
  renderSlots();
  renderBank();
  renderQuestions();
  updateScore();
}

function renderSlots() {
  slotsEl.innerHTML = "";
  for (let n = 1; n <= 50; n++) {
    const li = el("li", { class: "slot", "data-n": n }, slotsEl);
    el("span", { class: "n", text: n + "." }, li);
    const box = el("div", { class: "box", "data-n": n }, li);
    if (mode === "drag") {
      if (placed[n]) makeChip(placed[n], n, box);
    } else {
      const inp = el("input", { type: "text", autocomplete: "off", autocapitalize: "words", spellcheck: "false", "aria-label": `State number ${n}`, "data-n": n }, box);
      inp.value = typed[n] || "";
      inp.addEventListener("input", () => { typed[n] = inp.value; store.set("typed", typed); clearMark(li); renderBank(); updateScore(); });
      inp.addEventListener("focus", () => focusSlot(n, false));
      inp.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); const next = slotsEl.querySelector(`input[data-n="${n + 1}"]`); next ? next.focus() : inp.blur(); }
      });
    }
    el("span", { class: "fb" }, li);
    li.addEventListener("mouseenter", () => hlState(n, true));
    li.addEventListener("mouseleave", () => hlState(n, false));
  }
}

function makeChip(name, from, parent) {
  const c = el("span", { class: "chip", "data-name": name, "data-from": from, text: name }, parent);
  if (selected && selected.name === name) c.classList.add("selected");
  c.addEventListener("pointerdown", startDrag);
  return c;
}

function renderBank() {
  bankEl.innerHTML = "";
  const usedDrag = new Set(Object.values(placed));
  const usedFill = new Set(Object.values(typed).map(norm));
  for (const name of BANK) {
    const c = mode === "drag" ? makeChip(name, "bank", bankEl) : el("span", { class: "chip", text: name }, bankEl);
    if (mode === "drag" ? usedDrag.has(name) : usedFill.has(norm(name))) c.classList.add("used");
  }
}

function renderQuestions() {
  const ol = $("#questions");
  ol.innerHTML = "";
  QUESTIONS.forEach((q, i) => {
    const li = el("li", {}, ol);
    el("label", { for: "q" + i, text: q.q }, li);
    const inp = el("input", { id: "q" + i, type: "text", autocomplete: "off", spellcheck: "false" }, li);
    inp.value = qans[i] || "";
    inp.addEventListener("input", () => { qans[i] = inp.value; store.set("qans", qans); li.className = ""; li.querySelector(".ans")?.remove(); });
  });
}

function updateScore() {
  const vals = mode === "drag" ? placed : typed;
  const filled = Object.values(vals).filter(v => v && v.trim()).length;
  if (!checked) { $("#score").textContent = `${filled} / 50 filled in`; return; }
  let right = 0;
  for (let n = 1; n <= 50; n++) if (norm(vals[n]) === norm(NUMS[n])) right++;
  $("#score").textContent = `${right} / 50 correct`;
}

/* ---------------- map + highlight ---------------- */
function hlState(n, on) {
  mapSvg.querySelector(`path[data-n="${n}"]`)?.classList.toggle("hl", on);
}
let focused = null;
function focusSlot(n, scroll) {
  if (focused) { slotsEl.querySelector(`.slot[data-n="${focused}"]`)?.classList.remove("focus"); hlState(focused, false); }
  focused = n;
  const li = slotsEl.querySelector(`.slot[data-n="${n}"]`);
  li?.classList.add("focus");
  hlState(n, true);
  if (scroll && li) {
    li.scrollIntoView({ behavior: "smooth", block: "center" });
    if (mode === "fill") li.querySelector("input")?.focus({ preventScroll: true });
  }
}
mapSvg.addEventListener("click", e => {
  const n = +e.target.dataset?.n;
  if (!n) return;
  if (mode === "drag" && selected) return place(selected.name, selected.from, n);
  focusSlot(n, true);
});
slotsEl.addEventListener("click", e => {
  const box = e.target.closest(".box");
  if (mode === "drag" && box && selected && !e.target.closest(".chip")) place(selected.name, selected.from, +box.dataset.n);
});
bankEl.addEventListener("click", e => {
  if (mode === "drag" && selected && selected.from !== "bank" && !e.target.closest(".chip")) place(selected.name, selected.from, null);
});

/* ---------------- placing (drag mode) ---------------- */
// Put `name` (coming from the bank or slot `from`) into slot `to`; to = null sends it back to the bank.
function place(name, from, to) {
  selected = null;
  if (from !== "bank") delete placed[from];
  else for (const k in placed) if (placed[k] === name) delete placed[k]; // never place a name twice
  if (to) {
    const prev = placed[to];
    if (prev && from !== "bank") placed[from] = prev; // swap two slots
    placed[to] = name;
    const li = slotsEl.querySelector(`.slot[data-n="${to}"]`);
    if (li) clearMark(li);
  }
  if (from !== "bank") clearMark(slotsEl.querySelector(`.slot[data-n="${from}"]`));
  store.set("placed", placed);
  renderSlots(); renderBank(); updateScore();
  if (to) flashState(to);
}
function flashState(n) {
  hlState(n, true);
  setTimeout(() => hlState(n, false), 450);
}

let drag = null;
const ghost = $("#ghost");
function startDrag(e) {
  if (mode !== "drag" || e.button > 0) return;
  const chip = e.currentTarget;
  drag = { name: chip.dataset.name, from: chip.dataset.from === "bank" ? "bank" : +chip.dataset.from, x: e.clientX, y: e.clientY, moving: false, over: null };
  e.preventDefault();
  document.addEventListener("pointermove", onDrag);
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
}
function dropTarget(x, y) {
  const t = document.elementFromPoint(x, y);
  if (!t) return null;
  const box = t.closest?.(".box");
  if (box) return { n: +box.dataset.n, node: box };
  if (t.matches?.("path.st")) return { n: +t.dataset.n, node: t };
  if (t.closest?.(".bank-card")) return { n: null, node: null };
  return undefined;
}
function onDrag(e) {
  if (!drag) return;
  if (!drag.moving && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
  if (!drag.moving) {
    drag.moving = true;
    ghost.textContent = drag.name;
    ghost.hidden = false;
    selected = null;
    document.querySelectorAll(".chip.selected").forEach(c => c.classList.remove("selected"));
  }
  ghost.style.left = e.clientX + "px";
  ghost.style.top = e.clientY + "px";
  const t = dropTarget(e.clientX, e.clientY);
  const node = t?.node || null;
  if (drag.over !== node) {
    drag.over?.classList.remove("dropover");
    if (drag.overN) hlState(drag.overN, false);
    node?.classList.add("dropover");
    drag.over = node;
    drag.overN = t?.n || null;
    if (drag.overN) hlState(drag.overN, true);
  }
  // auto-scroll near the window edges
  const edge = 60;
  if (e.clientY < edge) window.scrollBy(0, -12);
  else if (e.clientY > innerHeight - edge) window.scrollBy(0, 12);
}
function endDrag(e) {
  document.removeEventListener("pointermove", onDrag);
  document.removeEventListener("pointerup", endDrag);
  document.removeEventListener("pointercancel", endDrag);
  if (!drag) return;
  const d = drag; drag = null;
  ghost.hidden = true;
  d.over?.classList.remove("dropover");
  if (d.overN) hlState(d.overN, false);
  if (!d.moving) {
    // a tap: select / unselect for tap-to-place
    selected = selected && selected.name === d.name ? null : { name: d.name, from: d.from };
    document.querySelectorAll(".chip").forEach(c => c.classList.toggle("selected", !!selected && c.dataset.name === selected.name));
    return;
  }
  if (e.type === "pointercancel") return;
  const t = dropTarget(e.clientX, e.clientY);
  if (t === undefined) { if (d.from !== "bank") place(d.name, d.from, null); return; }
  if (t.n === d.from) return;
  place(d.name, d.from, t.n);
}

/* ---------------- checking ---------------- */
function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
function clearMark(li) {
  if (!li) return;
  li.classList.remove("good", "bad", "close");
  li.querySelector(".fb").textContent = "";
}
function check() {
  checked = true;
  const vals = mode === "drag" ? placed : typed;
  let right = 0, blank = 0;
  for (let n = 1; n <= 50; n++) {
    const li = slotsEl.querySelector(`.slot[data-n="${n}"]`);
    clearMark(li);
    const v = norm(vals[n]), want = norm(NUMS[n]);
    if (!v) { blank++; continue; }
    if (v === want) { li.classList.add("good"); right++; }
    else if (mode === "fill" && lev(v, want) <= 2) { li.classList.add("close"); li.querySelector(".fb").textContent = "spelling?"; }
    else li.classList.add("bad");
  }
  document.querySelectorAll("#questions li").forEach((li, i) => {
    const t = norm(qans[i]);
    li.querySelector(".ans")?.remove();
    li.className = "";
    if (!t) return;
    if (QUESTIONS[i].ok(t)) li.className = "good";
    else { li.className = "bad"; }
  });
  updateScore();
  toast(right === 50 ? "🎉 All 50 correct! Amazing!" :
        `${right} correct` + (blank ? `, ${blank} still blank` : "") + (right >= 40 ? " — so close!" : " — keep going!"));
}
function reveal() {
  if (!confirm("Fill in every answer? (Good for studying — you can start over after.)")) return;
  for (let n = 1; n <= 50; n++) {
    if (mode === "drag") placed[n] = NUMS[n]; else typed[n] = NUMS[n];
  }
  qans = QUESTIONS.map(q => q.answer);
  store.set("placed", placed); store.set("typed", typed); store.set("qans", qans);
  checked = false;
  render();
}
function reset() {
  if (!confirm("Clear all your answers and start over?")) return;
  if (mode === "drag") placed = {}; else typed = {};
  qans = ["", "", ""];
  store.set("placed", placed); store.set("typed", typed); store.set("qans", qans);
  checked = false; selected = null;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
let toastTimer;
function toast(msg) {
  let t = $(".toast");
  if (!t) t = el("div", { class: "toast", role: "status" }, document.body);
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3200);
}

/* ---------------- printable sheet ---------------- */
function renderSheet(withAnswers) {
  const s = $("#sheet");
  s.innerHTML = "";
  const name = el("div", { class: "name" }, s);
  name.append("Name ");
  el("span", {}, name);
  buildMap(s, false);
  const lines = el("div", { class: "lines" }, s);
  for (let n = 1; n <= 50; n++) {
    const ln = el("div", { class: "ln" }, lines);
    el("b", { text: n + "." }, ln);
    el("span", { text: withAnswers ? NUMS[n] : "" }, ln);
  }
  const qs = el("ol", { class: "qs" }, s);
  QUESTIONS.forEach((q, i) => {
    const li = el("li", {}, qs);
    li.append(`${i + 1}. ${q.q}`);
    el("span", { text: withAnswers ? q.answer : "" }, li);
  });
  const bank = el("div", { class: "bank-box" }, s);
  BANK.forEach(n => el("div", { text: n }, bank));
}
function printSheet(withAnswers) {
  renderSheet(withAnswers);
  window.print();
  setTimeout(() => renderSheet(false), 500);
}

/* ---------------- wiring ---------------- */
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
  mode = b.dataset.mode;
  store.set("mode", mode);
  checked = false; selected = null; focused = null;
  render();
}));
$("#checkBtn").addEventListener("click", check);
$("#revealBtn").addEventListener("click", reveal);
$("#resetBtn").addEventListener("click", reset);
$("#printBlank").addEventListener("click", () => printSheet(false));
$("#printKey").addEventListener("click", () => printSheet(true));

render();
