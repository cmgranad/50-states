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
    el("svg:circle", { cx: x, cy: y, r: 12, class: "num-bg", "data-n": n }, gl);
    el("svg:text", { x, y, class: "num", "data-n": n, text: n }, gl);
  }
  container.appendChild(svg);
  return svg;
}


/* ---------------- state ---------------- */
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("states50:" + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("states50:" + k, JSON.stringify(v)); } catch {} },
};
let phase = store.get("phase", "practice");   // practice | test | print
let kind = store.get("kind", "drag");         // drag | fill
let ans = store.get("answers", { practice: { drag: {}, fill: {} }, test: { drag: {}, fill: {} } });
let qans = store.get("questions", { practice: ["", "", ""], test: ["", "", ""] });
let testDone = store.get("testDone", { drag: false, fill: false });
let history = store.get("history", []);       // [{ d, s, kind }]
let feedback = {};                            // practice fill-in: n -> "try" | "close"
let selected = null;                          // tap-to-place: { name, from: "bank" | n }

const save = () => {
  store.set("answers", ans); store.set("questions", qans);
  store.set("testDone", testDone); store.set("history", history);
};
const cur = () => ans[phase][kind];
const isRight = n => norm(cur()[n]) === norm(NUMS[n]);
const countRight = () => { let c = 0; for (let n = 1; n <= 50; n++) if (isRight(n)) c++; return c; };
const finished = () => phase === "test" && testDone[kind];
const pick = a => a[Math.floor(Math.random() * a.length)];

const CHEERS = ["Nice!", "You got it!", "Yes! ⭐", "Great job!", "Awesome!", "Way to go!", "Nailed it!"];
const NUDGES = ["Not quite — try another spot!", "So close! Try a different state.", "Hmm, not that one. Keep looking!"];

function encouragement(right) {
  if (right === 50) return "All 50! You're a geography superstar! 🌟";
  if (right >= 45) return "Wow — almost every single one! 🎉";
  if (right >= 35) return "Great job! You really know your states.";
  if (right >= 25) return "Nice work! You're more than halfway there.";
  if (right >= 10) return "Nice! You're learning fast.";
  return "Great start — every state you learn counts!";
}

const $ = s => document.querySelector(s);
const mapSvg = buildMap($("#map"), true);
const slotsEl = $("#slots"), bankEl = $("#bank");

/* ---------------- countdown ---------------- */
(() => {
  const quiz = new Date(2026, 10, 12), now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Math.round((quiz - now) / 864e5);
  $("#countdown").textContent =
    days > 1 ? `Quiz on Thursday, Nov 12 — ${days} days to practice!` :
    days === 1 ? "Quiz is tomorrow! You've got this." :
    days === 0 ? "Quiz day! Good luck! 🍀" : "Keep practicing — you know your states!";
})();

/* ---------------- rendering ---------------- */
function render() {
  document.body.className = `phase-${phase} kind-${kind}` + (finished() ? " done" : "");
  document.querySelectorAll("[data-phase]").forEach(b => b.setAttribute("aria-selected", b.dataset.phase === phase));
  document.querySelectorAll("[data-kind]").forEach(b => b.setAttribute("aria-selected", b.dataset.kind === kind));
  $("#practice").hidden = phase === "print";
  $("#printPanel").hidden = phase !== "print";
  $("#subbar").hidden = phase === "print";
  if (phase === "print") return renderSheet(false);

  $("#phaseNote").textContent = phase === "practice"
    ? "Practice: you'll know right away if you got it. Use a hint anytime!"
    : finished() ? "Test finished! Green ones you knew; the others show the right answer."
    : "Test: just like the real quiz. Answers get checked when you tap “I'm finished.”";
  $("#bankHint").textContent = kind === "drag" ? "Drag a name to its number (or tap a name, then tap a box)" : "Type each name — the bank crosses them off";
  $("#mapHint").textContent = kind === "drag" ? "Tip: you can also drop a name right onto the map." : "Tip: tap a state on the map to jump to its box.";
  document.querySelectorAll(".btns [data-for]").forEach(b => {
    const f = b.dataset.for;
    b.hidden = !(f === phase || (f === "test-open" && phase === "test" && !finished()) || (f === "test-done" && finished()));
  });
  renderSlots();
  renderBank();
  renderQuestions();
  renderMap();
  updateProgress();
}

function slotStatus(n) {
  const v = cur()[n];
  if (phase === "practice") return isRight(n) ? "good" : feedback[n] || "";
  if (finished()) return isRight(n) ? "good" : "miss";
  return "";
}

function renderSlots() {
  slotsEl.innerHTML = "";
  for (let n = 1; n <= 50; n++) {
    const li = el("li", { class: "slot", "data-n": n }, slotsEl);
    el("span", { class: "n", text: n + "." }, li);
    const box = el("div", { class: "box", "data-n": n }, li);
    const v = cur()[n];
    if (kind === "drag") {
      if (v) {
        const chip = makeChip(v, n, box);
        if (phase === "practice" || finished()) chip.classList.add("locked");
      }
    } else {
      const inp = el("input", { type: "text", autocomplete: "off", autocapitalize: "words", spellcheck: "false", "aria-label": `State number ${n}`, "data-n": n }, box);
      inp.value = v || "";
      inp.readOnly = finished() || (phase === "practice" && isRight(n));
      inp.addEventListener("input", () => {
        cur()[n] = inp.value; delete feedback[n]; save();
        setStatus(n); renderBank(); renderMap(); updateProgress();
      });
      inp.addEventListener("change", () => phase === "practice" && gradeOne(n));
      inp.addEventListener("focus", () => focusSlot(n, false));
      inp.addEventListener("keydown", e => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (phase === "practice") gradeOne(n);
        if (phase === "practice" && !isRight(n)) return; // stay put so he can fix it
        nextInput(n)?.focus();
      });
    }
    el("span", { class: "fb" }, li);
    setStatus(n, li);
    li.addEventListener("mouseenter", () => hlState(n, true));
    li.addEventListener("mouseleave", () => hlState(n, false));
  }
}
function nextInput(n) {
  for (let k = n + 1; k <= 50; k++) {
    const i = slotsEl.querySelector(`input[data-n="${k}"]`);
    if (i && !i.readOnly) return i;
  }
  return null;
}

function setStatus(n, li = slotsEl.querySelector(`.slot[data-n="${n}"]`)) {
  if (!li) return;
  const s = slotStatus(n);
  li.classList.remove("good", "try", "close", "miss");
  if (s) li.classList.add(s);
  li.querySelector(".fb").textContent =
    s === "good" ? "✓" : s === "close" ? "almost — check spelling!" : s === "try" ? "try again" :
    s === "miss" ? "→ " + NUMS[n] : "";
}

function makeChip(name, from, parent) {
  const c = el("span", { class: "chip", "data-name": name, "data-from": from, text: name }, parent);
  if (selected && selected.name === name) c.classList.add("selected");
  c.addEventListener("pointerdown", startDrag);
  return c;
}

function renderBank() {
  bankEl.innerHTML = "";
  const vals = Object.values(cur());
  const used = new Set(kind === "drag" ? vals : vals.map(norm));
  for (const name of BANK) {
    const c = kind === "drag" ? makeChip(name, "bank", bankEl) : el("span", { class: "chip", "data-name": name, text: name }, bankEl);
    let isUsed = used.has(kind === "drag" ? name : norm(name));
    if (phase === "practice" && kind === "fill") isUsed = isRight(NUM_OF[name]);
    if (isUsed) c.classList.add("used");
  }
}

function renderQuestions() {
  const ol = $("#questions");
  ol.innerHTML = "";
  const list = qans[phase];
  QUESTIONS.forEach((q, i) => {
    const li = el("li", {}, ol);
    el("label", { for: "q" + i, text: q.q }, li);
    const inp = el("input", { id: "q" + i, type: "text", autocomplete: "off", spellcheck: "false" }, li);
    const fb = el("div", { class: "ans" }, li);
    inp.value = list[i] || "";
    const grade = () => {
      const t = norm(list[i]);
      li.className = !t ? "" : q.ok(t) ? "good" : phase === "practice" ? "try" : "miss";
      fb.textContent = li.className === "good" ? "✓ Yes!" : li.className === "try" ? "Not quite — try again!" :
        li.className === "miss" ? "Answer: " + q.answer : "";
    };
    if (phase === "practice" || finished()) grade();
    if (finished()) { inp.readOnly = true; if (!list[i]) { li.className = "miss"; fb.textContent = "Answer: " + q.answer; } }
    inp.addEventListener("input", () => { list[i] = inp.value; save(); li.className = ""; fb.textContent = ""; });
    inp.addEventListener("change", () => phase === "practice" && grade());
  });
}

function renderMap() {
  for (let n = 1; n <= 50; n++) {
    const has = !!(cur()[n] || "").trim();
    const s = slotStatus(n);
    const right = s === "good", miss = s === "miss";
    const answered = phase === "test" && !finished() && has;
    for (const node of mapSvg.querySelectorAll(`[data-n="${n}"]`)) {
      node.classList.toggle("answered", answered);
      node.classList.toggle("right", right);
      node.classList.toggle("miss", miss);
    }
  }
}

function updateProgress() {
  const right = countRight();
  const answered = Object.values(cur()).filter(v => v && v.trim()).length;
  let score, msg, pct;
  if (phase === "practice") {
    pct = right / 50;
    score = `⭐ ${right} of 50 states`;
    msg = right === 0 ? (kind === "drag" ? "Let's go! Drag a name to its spot." : "Let's go! Type a state name in any box.") : encouragement(right);
  } else if (!finished()) {
    pct = answered / 50;
    score = `${answered} of 50 answered`;
    msg = answered === 50 ? "All filled in! Tap “I'm finished” when you're ready." : "Take your time — you've got this!";
  } else {
    pct = right / 50;
    score = `You knew ${right} states! ⭐`;
    msg = encouragement(right);
  }
  $("#score").textContent = score;
  $("#scoreMsg").textContent = msg;
  $("#bar").style.width = Math.round(pct * 100) + "%";
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
    if (kind === "fill") li.querySelector("input")?.focus({ preventScroll: true });
  }
}
mapSvg.addEventListener("click", e => {
  const n = +e.target.dataset?.n;
  if (!n) return;
  if (kind === "drag" && selected) return place(selected.name, selected.from, n);
  focusSlot(n, true);
});
slotsEl.addEventListener("click", e => {
  const box = e.target.closest(".box");
  if (kind === "drag" && box && selected && !e.target.closest(".chip")) place(selected.name, selected.from, +box.dataset.n);
});
bankEl.addEventListener("click", e => {
  if (kind === "drag" && selected && selected.from !== "bank" && !e.target.closest(".chip")) place(selected.name, selected.from, null);
});

/* ---------------- placing (drag mode) ---------------- */
// Put `name` (coming from the bank or slot `from`) into slot `to`; to = null sends it back to the bank.
function place(name, from, to) {
  selected = null;
  if (finished()) return render();
  const vals = cur();
  if (phase === "practice") {
    if (to == null) return render();
    if (NUMS[to] === name) {
      vals[to] = name; save(); render();
      flash(to, "pop");
      toast(countRight() === 50 ? "🎉 All 50! You did it!" : pick(CHEERS), 1200);
    } else if (isRight(to)) {
      render(); toast("That one's already done ✓", 1400);
    } else {
      render(); flash(to, "shake"); toast(pick(NUDGES), 1600);
    }
    return;
  }
  if (from !== "bank") delete vals[from];
  else for (const k in vals) if (vals[k] === name) delete vals[k]; // never place a name twice
  if (to) {
    const prev = vals[to];
    if (prev && from !== "bank") vals[from] = prev; // swap two slots
    vals[to] = name;
  }
  save(); render();
  if (to) flash(to, "pop");
}
function flash(n, cls) {
  const nodes = [slotsEl.querySelector(`.slot[data-n="${n}"] .box`), mapSvg.querySelector(`path[data-n="${n}"]`)];
  nodes.forEach(x => { if (!x) return; x.classList.remove(cls); void x.getBoundingClientRect(); x.classList.add(cls); });
  setTimeout(() => nodes.forEach(x => x?.classList.remove(cls)), 600);
}

let drag = null;
const ghost = $("#ghost");
function startDrag(e) {
  const chip = e.currentTarget;
  if (kind !== "drag" || e.button > 0 || chip.classList.contains("locked") || finished()) return;
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

/* ---------------- practice helpers ---------------- */
function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
function gradeOne(n) {
  const v = norm(cur()[n]);
  if (!v) { delete feedback[n]; setStatus(n); return; }
  if (isRight(n)) {
    delete feedback[n];
    const inp = slotsEl.querySelector(`input[data-n="${n}"]`);
    if (inp) inp.readOnly = true;
    flash(n, "pop");
    toast(countRight() === 50 ? "🎉 All 50! You did it!" : pick(CHEERS), 1200);
  } else {
    feedback[n] = lev(v, norm(NUMS[n])) <= 2 ? "close" : "try";
  }
  setStatus(n); renderBank(); renderMap(); updateProgress();
}
function hint() {
  let n = focused && !isRight(focused) ? focused : null;
  for (let k = 1; !n && k <= 50; k++) if (!isRight(k)) n = k;
  if (!n) return toast("You've got them all! 🌟");
  focusSlot(n, true);
  const name = NUMS[n];
  if (kind === "drag") {
    const chip = bankEl.querySelector(`.chip[data-name="${name}"]`);
    chip?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    chip?.classList.add("pulse");
    setTimeout(() => chip?.classList.remove("pulse"), 2600);
    toast(`Hint for #${n}: look for the glowing name in the word bank!`, 2600);
  } else {
    const inp = slotsEl.querySelector(`input[data-n="${n}"]`);
    if (inp) { inp.placeholder = name.slice(0, 2) + "…"; inp.focus(); }
    toast(`Hint for #${n}: it starts with “${name.slice(0, 2)}”`, 2600);
  }
}
function reveal() {
  if (!confirm("Fill in every answer so you can study them?")) return;
  for (let n = 1; n <= 50; n++) cur()[n] = NUMS[n];
  qans.practice = QUESTIONS.map(q => q.answer);
  feedback = {}; save(); render();
}
function resetPractice() {
  if (!confirm("Clear this practice and start fresh?")) return;
  ans.practice[kind] = {}; qans.practice = ["", "", ""];
  feedback = {}; selected = null; save(); render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------------- test ---------------- */
function finishTest() {
  const blank = 50 - Object.values(cur()).filter(v => v && v.trim()).length;
  if (blank && !confirm(`You still have ${blank} blank. That's okay! Finish now?`)) return;
  testDone[kind] = true;
  history.push({ d: new Date().toISOString().slice(0, 10), s: countRight(), kind });
  history = history.slice(-30);
  save(); render(); showResults(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showResults(fresh) {
  const right = countRight();
  const qRight = QUESTIONS.filter((q, i) => q.ok(norm(qans.test[i]))).length;
  const stars = Math.max(1, Math.ceil(right / 10));
  const d = $("#results");
  $("#resStars").textContent = "⭐".repeat(stars);
  $("#resTitle").textContent = `You know ${right} states!`;
  $("#resMsg").textContent = encouragement(right);
  $("#resBonus").textContent = qRight === 3 ? "Bonus questions: all 3 — perfect! 🎯" :
    qRight ? `Bonus questions: ${qRight} of 3 ✓` : "Bonus questions: give them another try next time!";

  // Only ever compare in a way that feels good.
  const past = history.slice(0, -1).filter(h => h.kind === kind);
  const prev = past[past.length - 1];
  const best = Math.max(right, ...past.map(h => h.s));
  let note = "";
  if (fresh && prev && right > prev.s) note = `That's ${right - prev.s} more than last time! 📈`;
  if (fresh && past.length && right >= best && right > Math.max(...past.map(h => h.s))) note += (note ? " " : "") + "Your best yet! 🏆";
  if (!note && past.length) note = `Your best so far: ${best} states.`;
  $("#resHistory").textContent = note;

  const misses = [];
  for (let n = 1; n <= 50; n++) if (!isRight(n)) misses.push(n);
  const list = $("#resList");
  list.innerHTML = "";
  $("#resPracticeHead").hidden = !misses.length;
  misses.forEach(n => el("span", { class: "chip", text: `${n}. ${NUMS[n]}` }, list));
  $("#practiceMisses").hidden = !misses.length;
  d.showModal();
}
function practiceMisses() {
  // Carry the ones he knew into practice so only the tricky ones are left.
  const known = {};
  for (let n = 1; n <= 50; n++) if (isRight(n)) known[n] = NUMS[n];
  ans.practice[kind] = known;
  qans.practice = ["", "", ""];
  feedback = {};
  phase = "practice";
  store.set("phase", phase); save();
  $("#results").close();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function newTest() {
  const started = Object.values(cur()).some(v => v && v.trim());
  if (started && !finished() && !confirm("Start a brand-new test? Your answers so far will be cleared.")) return;
  ans.test[kind] = {}; qans.test = ["", "", ""]; testDone[kind] = false;
  selected = null; save(); render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

let toastTimer;
function toast(msg, ms = 2800) {
  let t = $(".toast");
  if (!t) t = el("div", { class: "toast", role: "status" }, document.body);
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
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
document.querySelectorAll("[data-phase]").forEach(b => b.addEventListener("click", () => {
  phase = b.dataset.phase;
  store.set("phase", phase);
  selected = null; focused = null; feedback = {};
  render();
}));
document.querySelectorAll("[data-kind]").forEach(b => b.addEventListener("click", () => {
  kind = b.dataset.kind;
  store.set("kind", kind);
  selected = null; focused = null; feedback = {};
  render();
}));
$("#hintBtn").addEventListener("click", hint);
$("#revealBtn").addEventListener("click", reveal);
$("#resetBtn").addEventListener("click", resetPractice);
$("#finishBtn").addEventListener("click", finishTest);
$("#resultsBtn").addEventListener("click", () => showResults(false));
$("#newTestBtn").addEventListener("click", newTest);
$("#practiceMisses").addEventListener("click", practiceMisses);
$("#closeResults").addEventListener("click", () => $("#results").close());
$("#printBlank").addEventListener("click", () => printSheet(false));
$("#printKey").addEventListener("click", () => printSheet(true));

render();
