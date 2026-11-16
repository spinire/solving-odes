/* Solving ODEs Numerically — shared engine (adapted from the Linear Algebra Refresher): module list, progress, maths helpers, questions. */
(function () {
  "use strict";

  const MODULES = [
    { id: "m01", n: 1, title: "What an ODE solver does", blurb: "You know how fast something changes, not the thing itself. Slope fields and initial value problems.", minutes: 25, href: "modules/01-what-a-solver-does.html" },
    { id: "m02", n: 2, title: "Euler's method", blurb: "Follow the slope for one short step, then repeat. How big the error is, and how it shrinks with the step.", minutes: 30, href: "modules/02-eulers-method.html" },
    { id: "m03", n: 3, title: "When Euler goes wrong: stability", blurb: "Why a step that is too large makes a decaying solution oscillate and blow up, and what to do about it.", minutes: 30, href: "modules/03-stability.html" },
    { id: "m04", n: 4, title: "Better slopes: Heun and RK4", blurb: "Averaging several slopes per step. Why RK4 is the standard choice.", minutes: 30, href: "modules/04-heun-rk4.html" },
    { id: "m05", n: 5, title: "ODE solvers in practice", blurb: "Systems of equations, an outbreak model, and what library solvers do for you.", minutes: 30, href: "modules/05-in-practice.html" },
  ];
  const OPTIONAL = null;
  const PASS_FRACTION = 0.8;

  /* ---------- progress (browser storage, with in-memory fallback) ---------- */
  const KEY = "odes-progress-v1";
  let memory = null;
  function blank() { return { v: 1, modules: {} }; }
  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) { const p = JSON.parse(raw); if (p && p.modules) return p; }
    } catch (e) { /* storage unavailable */ }
    return memory || blank();
  }
  function save(p) {
    memory = p;
    try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
  }
  function today() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function markPassed(id, score, total) {
    const p = load();
    const prev = p.modules[id];
    p.modules[id] = { passed: true, date: prev && prev.passed ? prev.date : today(), best: Math.max(score, prev ? prev.best || 0 : 0), total: total };
    save(p);
  }
  function status(id) { return load().modules[id] || null; }
  function passedCount() { return MODULES.filter(m => (status(m.id) || {}).passed).length; }
  function allPassed() { return passedCount() === MODULES.length; }
  function resetProgress() { save(blank()); }
  function b64urlEncode(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function b64urlDecode(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return decodeURIComponent(escape(atob(s))); }
  function exportCode() { return "ODE1." + b64urlEncode(JSON.stringify(load())); }
  function importCode(code) {
    code = (code || "").trim();
    if (!code.startsWith("ODE1.")) throw new Error("That doesn't look like a progress code.");
    const p = JSON.parse(b64urlDecode(code.slice(5)));
    if (!p || typeof p.modules !== "object") throw new Error("That progress code is damaged.");
    const mine = load();
    for (const [id, rec] of Object.entries(p.modules)) {
      if (!MODULES.some(m => m.id === id) || !rec || !rec.passed) continue;
      const cur = mine.modules[id];
      if (!cur || !cur.passed || (rec.date && rec.date < cur.date)) mine.modules[id] = { passed: true, date: String(rec.date || today()).slice(0, 10), best: Number(rec.best) || 0, total: Number(rec.total) || 0 };
    }
    save(mine);
  }

  /* ---------- certificate code: a checksum of the name and the completion date ----------
     It lets the instructor confirm that the name and date on a submitted certificate were not
     edited after it was produced. It cannot prove who did the work (progress lives in the browser). */
  function normName(n) { return String(n || "").trim().replace(/\s+/g, " ").toLowerCase(); }
  function fnv(s) { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; }
  function certCode(name, date) {
    const base = "odes1|" + normName(name) + "|" + date;
    const a = fnv(base).toString(36).toUpperCase().padStart(7, "0").slice(-4);
    const b = fnv(base + "#").toString(36).toUpperCase().padStart(7, "0").slice(-4);
    return "ODE-" + a + "-" + b;
  }

  /* ---------- small maths helpers ---------- */
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function randNonZero(a, b) { let v; do { v = randInt(a, b); } while (v === 0); return v; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function parseNum(s) {
    if (s == null) return NaN;
    s = String(s).trim().replace(/−/g, "-").replace(/\s+/g, "");
    if (s === "" || s === "-" || s === "+") return NaN;
    const frac = s.match(/^([+-]?\d+(?:\.\d+)?)\/([+-]?\d+(?:\.\d+)?)$/);
    if (frac) { const d = Number(frac[2]); return d === 0 ? NaN : Number(frac[1]) / d; }
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return NaN;
    return Number(s);
  }
  function close(a, b) { return Math.abs(a - b) < 1e-9; }
  function sameVec(u, v) { return u.length === v.length && u.every((x, i) => close(x, v[i])); }
  function fmt(x) {
    if (Number.isInteger(x)) return String(x);
    for (const d of [2, 3, 4, 5, 6, 8, 10]) { const n = x * d; if (close(n, Math.round(n))) return (Math.round(n) < 0 ? "-" : "") + "\\tfrac{" + Math.abs(Math.round(n)) + "}{" + d + "}"; }
    return String(Math.round(x * 1000) / 1000);
  }
  function fmtPlain(x) { return Number.isInteger(x) ? String(x).replace("-", "−") : String(Math.round(x * 100) / 100).replace("-", "−"); }
  function matVec(A, x) { return A.map(row => row.reduce((s, a, j) => s + a * x[j], 0)); }
  function transpose(A) { return A[0].map((_, j) => A.map(r => r[j])); }
  function col(A, j) { return A.map(r => r[j]); }
  /* TeX: vectors and matrices; colour=true tints column 1 and column 2 */
  function vecTex(v, cls) {
    const body = v.map(fmt).join("\\\\");
    const m = "\\begin{bmatrix}" + body + "\\end{bmatrix}";
    return cls ? "\\" + cls + "{" + m + "}" : m;
  }
  function matTex(A, colour) {
    const rows = A.map(r => r.map((a, j) => {
      const t = fmt(a);
      if (!colour || j > 1) return t;
      return (j === 0 ? "\\cone{" : "\\ctwo{") + t + "}";
    }).join(" & "));
    return "\\begin{bmatrix}" + rows.join("\\\\") + "\\end{bmatrix}";
  }

  /* ---------- maths rendering ---------- */
  const KATEX_OPTS = {
    delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\(", right: "\\)", display: false }, { left: "$", right: "$", display: false }],
    throwOnError: false,
    ignoredClasses: ["nomath"],
    strict: code => (code === "htmlExtension" ? "ignore" : "warn"),
    trust: ctx => ctx.command === "\\htmlClass",
    macros: { "\\cone": "\\htmlClass{c1}{#1}", "\\ctwo": "\\htmlClass{c2}{#1}", "\\R": "\\mathbb{R}" },
  };
  /* an equation wider than the screen scrolls sideways; make it keyboard-focusable so it can be scrolled without a mouse */
  function markScrollables() {
    document.querySelectorAll(".display").forEach(d => {
      if (d.scrollWidth > d.clientWidth) { d.setAttribute("tabindex", "0"); d.setAttribute("role", "group"); d.setAttribute("aria-label", "Equation (scrolls sideways)"); }
      else if (d.getAttribute("tabindex") === "0") { d.removeAttribute("tabindex"); d.removeAttribute("role"); d.removeAttribute("aria-label"); }
    });
  }
  let scrollTimer = null;
  window.addEventListener("resize", () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(markScrollables, 200); });
  window.addEventListener("load", markScrollables);
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(markScrollables); } catch (e) { /* ignore */ }
  function speakLabel(t) {
    return t.replace(/\$([^$]*)\$/g, (_, x) => x.replace(/\\(?:times)/g, " times ").replace(/_\{([^}]*)\}|_(\S)/g, (m, a, c) => " " + (a || c)).replace(/\\([a-zA-Z]+)/g, " $1 ").replace(/[{}]/g, ""))
      .replace(/\s+/g, " ").trim();
  }
  /* keep punctuation that follows inline maths on the same line as the maths */
  function glueTrailingPunctuation(root) {
    (root || document.body).querySelectorAll(".katex:not(.katex-display .katex)").forEach(kx => {
      /* auto-render puts each formula in a plain <span>; glue the punctuation to that wrapper */
      const pe = kx.parentElement;
      const k = pe && pe.tagName === "SPAN" && !pe.className && pe.childNodes.length === 1 ? pe : kx;
      if (k.parentElement && k.parentElement.classList.contains("nobr")) return;
      const nx = k.nextSibling;
      if (!nx || nx.nodeType !== 3) return;
      const m = nx.textContent.match(/^[.,;:!?)]+/);
      if (!m) return;
      const wrap = document.createElement("span");
      wrap.className = "nobr";
      k.parentNode.insertBefore(wrap, k);
      wrap.appendChild(k);
      wrap.appendChild(document.createTextNode(m[0]));
      nx.textContent = nx.textContent.slice(m[0].length);
    });
  }
  function renderMath(el) {
    if (window.renderMathInElement) window.renderMathInElement(el || document.body, KATEX_OPTS);
    glueTrailingPunctuation(el);
    markScrollables();
  }

  /* plain-language reading of simple TeX (matrices, vectors, coloured numbers) */
  function texSpeak(t) {
    t = t.replace(/\\(?:cone|ctwo)\{([^{}]*)\}/g, "$1").replace(/\\htmlClass\{[^}]*\}\{([^{}]*)\}/g, "$1");
    t = t.replace(/\\begin\{bmatrix\}([\s\S]*?)\\end\{bmatrix\}/g, (_, body) => {
      const rows = body.split("\\\\").map(r => r.split("&").map(x => x.trim()));
      if (rows.every(r => r.length === 1)) return "the vector (" + rows.map(r => r[0]).join(", ") + ")";
      return "matrix, " + rows.map((r, i) => "row " + (i + 1) + ": " + r.join(", ")).join("; ");
    });
    return t.replace(/\\tfrac\{(\d+)\}\{(\d+)\}/g, "$1/$2").replace(/-/g, "minus ").replace(/[{}\\]/g, "").replace(/\s+/g, " ").trim();
  }

  /* ---------- questions ----------
     q = { prompt, kind: 'vector'|'matrix'|'numbers'|'mc', answer, n, labels, options:[{html, why}],
           figure, diagnose(values) -> html|null, explain }                                        */
  let uid = 0;
  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v !== undefined && v !== null) e.setAttribute(k, v); }
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function buildQuestion(container, q, opts) {
    opts = opts || {};
    const id = "q" + (++uid);
    container.innerHTML = "";
    container._q = q;
    if (q.kind === "mc" && !q._shuffled) {
      /* shuffle options so the correct answer is not always in the same position */
      const perm = shuffle(q.options.map((_, i) => i));
      q.answer = perm.indexOf(q.answer);
      q.options = perm.map(i => q.options[i]);
      q._shuffled = true;
    }
    const promptEl = el("div", { class: "qprompt", id: id + "-p" }, (opts.number ? '<span class="qnum">Question ' + opts.number + '</span><br>' : "") + q.prompt);
    container.appendChild(promptEl);
    if (q.figure) container.appendChild(el("div", { class: "qfigure" }, q.figure));
    const inputs = [];
    const area = el("div", { class: "qanswer" });
    if (q.kind === "vector" || q.kind === "matrix") {
      const wrap = el("div", { class: "entry" });
      if (q.before) wrap.appendChild(el("span", null, q.before));
      const rows = q.rows || 2, cols = q.cols || 2;
      const br = el("div", { class: "bracket", role: "group", "aria-label": q.kind === "matrix" ? "Your " + rows + " by " + cols + " matrix" : "Your vector" });
      if (q.kind === "matrix") br.style.gridTemplateColumns = "repeat(" + cols + ", auto)";
      const count = q.kind === "matrix" ? rows * cols : q.n;
      for (let i = 0; i < count; i++) {
        let label;
        if (q.kind === "matrix") label = "row " + (Math.floor(i / cols) + 1) + ", column " + (i % cols + 1);
        else label = "entry " + (i + 1) + " of " + count;
        const inp = el("input", { type: "text", inputmode: "decimal", autocomplete: "off", "aria-label": label, "aria-describedby": id + "-p" });
        br.appendChild(inp); inputs.push(inp);
      }
      wrap.appendChild(br);
      area.appendChild(wrap);
    } else if (q.kind === "numbers") {
      q.labels.forEach((lab, i) => {
        const lid = id + "-n" + i;
        const row = el("p", null);
        row.appendChild(el("label", { for: lid }, lab + " "));
        const inp = el("input", { type: "text", inputmode: "decimal", id: lid, autocomplete: "off" });
        /* a label written in maths gets a plain spoken name too, e.g. "$y_1 =$" -> "y 1 =" */
        if (/\$/.test(lab)) inp.setAttribute("aria-label", speakLabel(lab));
        row.appendChild(inp); inputs.push(inp); area.appendChild(row);
      });
    } else if (q.kind === "mc") {
      const fs = el("fieldset", { style: "border:0;padding:0;margin:0" });
      fs.appendChild(el("legend", { class: "visually-hidden", style: "position:absolute;left:-9999px" }, "Choose one answer"));
      const ul = el("ul", { class: "choices" });
      q.options.forEach((o, i) => {
        const li = el("li");
        const lab = el("label");
        const inp = el("input", { type: "radio", name: id + "-mc", value: String(i) });
        lab.appendChild(inp); lab.appendChild(el("span", null, o.html));
        li.appendChild(lab); ul.appendChild(li); inputs.push(inp);
      });
      fs.appendChild(ul); area.appendChild(fs);
    }
    container.appendChild(area);
    const fb = el("div", { class: "feedback", role: "status", "aria-live": "polite" });
    container.appendChild(fb);
    renderMath(container);
    if (q.kind === "mc") {
      /* give radios whose label is only maths a spoken name, e.g. "matrix, row 1: 0, 3; row 2: 2, 1" */
      inputs.forEach((inp, i) => {
        const lab = inp.closest("label");
        const plain = lab.cloneNode(true);
        plain.querySelectorAll(".katex").forEach(k => k.remove());
        if (plain.textContent.replace(/[\s.,;:]/g, "") !== "") return;
        const o = q.options[i];
        inp.setAttribute("aria-label", o.alt || texSpeak((o.html.match(/\$([^$]*)\$/) || [])[1] || o.html));
      });
    }

    function values() {
      if (q.kind === "mc") { const c = inputs.findIndex(i => i.checked); return c; }
      return inputs.map(i => parseNum(i.value));
    }
    function answered() {
      const v = values();
      return q.kind === "mc" ? v >= 0 : v.every(x => !Number.isNaN(x));
    }
    function isCorrect() {
      const v = values();
      if (q.kind === "mc") return v === q.answer;
      if (q.tol) return v.length === q.answer.length && v.every((x, i) => Math.abs(x - q.answer[i]) <= q.tol);
      return sameVec(v, q.answer);
    }
    function show(kind, html) {
      fb.className = "feedback show " + kind;
      fb.innerHTML = html;
      renderMath(fb);
    }
    /* opts.explainCorrect / opts.explainWrong: append the worked explanation; opts.review: add a "review" pointer when wrong */
    function grade(opts) {
      opts = opts || {};
      if (!answered()) {
        const blank = q.kind === "mc" ? "Choose an answer first." : "Fill in every box (whole numbers, decimals like 0.5, or fractions like 1/2).";
        return { answered: false, correct: false, message: blank };
      }
      const ok = isCorrect();
      let msg;
      if (ok) {
        msg = '<strong class="verdict">Correct.</strong>' + (opts.explainCorrect && q.explain ? q.explain : "");
      } else {
        let specific = null;
        if (q.kind === "mc") specific = q.options[values()].why || null;
        else if (q.diagnose) specific = q.diagnose(values());
        if (!specific && q.hint) specific = q.hint;
        msg = '<strong class="verdict">Not quite.</strong>' + (specific ? "<p>" + specific + "</p>" : "") +
          (opts.review && q.review ? '<p>Review: <a href="' + q.review.href + '">' + q.review.label + "</a>.</p>" : "") +
          (opts.explainWrong && q.explain ? q.explain : "");
      }
      return { answered: true, correct: ok, message: msg };
    }
    function lock() { inputs.forEach(i => { i.disabled = true; }); }
    return { grade, show, lock, inputs, q };
  }

  /* Practice: one problem at a time, unlimited, unscored. gens = array of generator functions. */
  function practice(root, gens) {
    let streak = 0, k = 0, current = null, wrongs = 0;
    const order = shuffle(gens.map((_, i) => i));
    const card = el("div", { class: "qcard" });
    const bar = el("div", { class: "buttons" });
    const checkBtn = el("button", { type: "button" }, "Check");
    const solBtn = el("button", { type: "button", class: "secondary", hidden: "" }, "Show solution");
    const nextBtn = el("button", { type: "button", class: "secondary" }, "New problem");
    const streakEl = el("span", { class: "streak", "aria-live": "polite" }, "");
    bar.append(checkBtn, solBtn, nextBtn, streakEl);
    root.append(card, bar);
    function next() {
      const g = gens[order[k % order.length]]; k++;
      if (k % order.length === 0) order.splice(0, order.length, ...shuffle(order));
      current = buildQuestion(card, g());
      wrongs = 0; solBtn.hidden = true; checkBtn.disabled = false;
      current.inputs.forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); check(); } }));
    }
    function check() {
      const r = current.grade({});
      if (!r.answered) { current.show("info", r.message); return; }
      if (r.correct) {
        streak++;
        current.show("good", r.message + (current.q.explain ? current.q.explain : ""));
        checkBtn.disabled = true; solBtn.hidden = true;
        nextBtn.focus();
      } else {
        streak = 0; wrongs++;
        current.show("bad", r.message + (wrongs >= 1 ? "<p>Try again, or show the solution.</p>" : ""));
        solBtn.hidden = false;
      }
      streakEl.textContent = streak >= 2 ? streak + " in a row" : "";
    }
    checkBtn.addEventListener("click", check);
    solBtn.addEventListener("click", () => { current.show("info", '<strong class="verdict">Solution</strong>' + (current.q.explain || "")); checkBtn.disabled = true; });
    nextBtn.addEventListener("click", next);
    next();
  }

  /* Quick check inside a lesson: answer, get a hint if wrong (not the answer), retry; the answer is shown only on request. */
  function quick(root, q) {
    const card = el("div");
    const btn = el("button", { type: "button" }, "Check");
    const show = el("button", { type: "button", class: "secondary", hidden: "" }, "Show the answer");
    const bar = el("div", { class: "buttons" }); bar.append(btn, show);
    root.append(card, bar);
    const h = buildQuestion(card, q);
    function go() {
      const r = h.grade({ explainCorrect: true });
      if (!r.answered) { h.show("info", r.message); return; }
      if (r.correct) { h.show("good", r.message); show.hidden = true; }
      else { h.show("bad", r.message + "<p>Change your answer and check again, or show the answer.</p>"); show.hidden = false; }
    }
    btn.addEventListener("click", go);
    show.addEventListener("click", () => { h.show("info", '<strong class="verdict">Answer</strong>' + (q.explain || "")); show.hidden = true; });
    h.inputs.forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter" && i.type !== "radio") { e.preventDefault(); go(); } }));
  }

  /* Module check: build() returns an array of questions (fresh numbers each time). */
  function moduleCheck(root, moduleId, build) {
    const list = el("div");
    const bar = el("div", { class: "buttons" });
    const submit = el("button", { type: "button" }, "Submit check");
    const again = el("button", { type: "button", class: "secondary", hidden: "" }, "Try a fresh version");
    bar.append(submit, again);
    const result = el("div", { class: "feedback", role: "status", "aria-live": "polite", tabindex: "-1" });
    root.append(list, bar, result);
    let handles = [];
    function fresh() {
      list.innerHTML = ""; result.className = "feedback"; result.innerHTML = "";
      handles = build().map((q, i) => { const c = el("div", { class: "qcard" }); list.appendChild(c); return buildQuestion(c, q, { number: i + 1 }); });
      submit.hidden = false; again.hidden = true;
      const st = status(moduleId);
      if (st && st.passed) { result.className = "feedback show good"; result.innerHTML = "You passed this module's check on " + st.date + ". You can take it again any time for practice."; }
    }
    function grade() {
      const rs = handles.map(h => h.grade({ explainCorrect: true, review: true }));
      const missing = rs.filter(r => !r.answered).length;
      if (missing && !submit.dataset.confirm) {
        submit.dataset.confirm = "1";
        result.className = "feedback show info";
        result.innerHTML = missing + (missing === 1 ? " question is" : " questions are") + " unanswered. Press Submit again to submit anyway.";
        return;
      }
      delete submit.dataset.confirm;
      const score = rs.filter(r => r.correct).length;
      const total = rs.length, need = Math.ceil(PASS_FRACTION * total);
      const passed = score >= need;
      /* Wrong answers get a hint and a pointer back to the lesson, not the answer itself.
         Once the check is passed, the full explanation is shown for anything missed. */
      rs.forEach((r, i) => {
        const hq = handles[i];
        let msg = r.message;
        if (!r.answered) msg = '<strong class="verdict">No answer.</strong>' + (hq.q.review ? '<p>Review: <a href="' + hq.q.review.href + '">' + hq.q.review.label + "</a>.</p>" : "");
        if (!r.correct && passed && hq.q.explain) msg += hq.q.explain;
        hq.show(r.correct ? "good" : "bad", msg);
        hq.lock();
      });
      if (passed) markPassed(moduleId, score, total);
      result.className = "feedback show " + (passed ? "good" : "bad");
      result.innerHTML = passed
        ? "<strong>" + score + " out of " + total + ". You passed.</strong> This module is marked complete on your progress page."
        : "<strong>" + score + " out of " + total + ".</strong> You need " + need + " to pass. Use the hints above, then try a fresh version. It has new numbers.";
      submit.hidden = true; again.hidden = false;
      result.focus();
      document.dispatchEvent(new CustomEvent("lar:progress"));
    }
    submit.addEventListener("click", grade);
    again.addEventListener("click", () => { fresh(); list.querySelector("input") && list.querySelector("input").focus(); });
    fresh();
  }

  /* two displayed equations side by side, wrapping onto separate lines on narrow screens */
  function pairDisplay(a, b) {
    return '<div class="display-pair"><div class="display">$$' + a + '$$</div><div class="display">$$' + b + '$$</div></div>';
  }

  window.LAR = {
    MODULES, OPTIONAL, PASS_FRACTION,
    certCode, normName, load, status, markPassed, passedCount, allPassed, resetProgress, exportCode, importCode, today,
    randInt, randNonZero, pick, shuffle, parseNum, sameVec, close, fmt, fmtPlain, matVec, transpose, col, vecTex, matTex,
    renderMath, texSpeak, pairDisplay, buildQuestion, practice, quick, moduleCheck,
  };
})();
