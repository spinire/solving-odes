/* Module 3 — Stability: test-equation explorer, stiff-thermometer explorer, quick checks, practice and module check. */
(function () {
  "use strict";
  const L = window.LAR, P = window.ODEPlot;
  const { randInt, pick, shuffle } = L;

  /* ---------------- number formatting ---------------- */
  const r6 = x => Math.round(x * 1e6) / 1e6;
  function fmtD(x) { x = r6(x); return Object.is(x, -0) ? "0" : String(x); }
  const plain = (x, d) => String(Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).replace("-", "−");
  function big(x) {
    const a = Math.abs(x);
    if (a < 1e5) return plain(x, a < 0.01 ? 5 : a < 1 ? 3 : 2);
    const e = Math.floor(Math.log10(a)), m = x / Math.pow(10, e);
    const sup = String(e).split("").map(c => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)]).join("");
    return plain(m, 1) + " × 10" + sup;
  }
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const lamY = lam => (lam === 1 ? "-y" : "-" + fmtD(lam) + "\\,y");
  const TOL = 0.0011;

  function behaviour(lk) {
    if (lk < 1) return "shrink steadily toward 0, like the true solution";
    if (lk === 1) return "drop to 0 in one step and stay there";
    if (lk < 2) return "flip sign every step, but still shrink toward 0";
    if (lk === 2) return "flip sign forever without shrinking";
    return "flip sign and grow every step: they blow up";
  }

  /* ---------------- explorer 1: Euler on the test problem y' = -2y ---------------- */
  function explorerTest(root) {
    const lam = 2, T = 8;
    root.innerHTML =
      '<p style="margin-top:0">The test problem with $r = 2$: $\\; y\' = -2y$, $\\; y(0) = 1$.</p>' +
      '<div class="slider-row"><label for="ex-k">Step $k$</label><input type="range" id="ex-k" min="0.05" max="1.5" step="0.05" value="0.2"><output for="ex-k"></output></div>' +
      '<p class="readout-big" aria-live="polite"></p>' +
      '<svg class="plot" role="img"></svg>' +
      '<p class="legend small"><span class="swatch sw-euler" aria-hidden="true"></span>Euler\'s values <span class="swatch sw-exact" aria-hidden="true"></span>true solution $e^{-2t}$</p>';
    L.renderMath(root);
    const slider = root.querySelector("#ex-k"), out = root.querySelector("output"), svg = root.querySelector("svg"), readout = root.querySelector(".readout-big");
    let timer = null;
    function update() {
      const k = Number(slider.value), lk = r6(lam * k), g = r6(1 - lk);
      out.textContent = k.toFixed(2);
      const p = P.make(svg, { x: [0, T], y: [-2, 2], xticks: [0, 2, 4, 6, 8], yticks: [-2, -1, 0, 1, 2], xlabel: "time t", ylabel: "y", clip: true });
      p.seg(0, 0, T, 0, "axis0");
      p.curve(t => Math.exp(-lam * t), 0, T, 160, "exact");
      const n = Math.floor(T / k + 1e-9), pts = [];
      let y = 1;
      for (let j = 0; j <= n; j++) { pts.push([j * k, y]); y *= g; }
      p.path(pts, "euler thin");
      pts.forEach(q => { if (Math.abs(q[1]) <= 2.05) p.dot(q[0], q[1], "euler-pt", 3.5); });
      const last = pts[pts.length - 1];
      const off = pts.some(q => Math.abs(q[1]) > 2);
      readout.innerHTML = "$rk = 2 \\times " + fmtD(k) + " = " + fmtD(lk) + "$, so $\\kappa = 1 - " + fmtD(lk) + " = " + fmtD(g) + "$. The computed values " + behaviour(lk) + "." +
        (off ? " After " + n + " steps the value is " + big(last[1]) + ", far off the chart." : "");
      L.renderMath(readout);
      svg.setAttribute("aria-label", "The true solution decays smoothly from 1 toward 0. Euler's values with step " + fmtD(k) + ": " + pts.slice(0, 8).map(q => plain(q[1], 3)).join(", ") + (pts.length > 8 ? ", and so on" : "") + ".");
    }
    slider.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 60); });
    update();
  }

  /* ---------------- explorer 2: the stiff thermometer y' = -50(y - cos t) ---------------- */
  function explorerStiff(root) {
    const lam = 50, T = 3, KS = [0.1, 0.05, 0.041, 0.039, 0.02];
    const exact = t => (lam * lam * Math.cos(t) + lam * Math.sin(t)) / (lam * lam + 1) - lam * lam / (lam * lam + 1) * Math.exp(-lam * t);
    root.innerHTML =
      '<p style="margin-top:0">Euler\'s method on $y\' = -50\\,(y - \\cos t)$, $y(0) = 0$, up to $t = 3$ hours. The stability limit is $k < 0.04$.</p>' +
      '<fieldset class="kpick"><legend>Step $k$ (hours)</legend>' +
      KS.map((k, i) => '<label><input type="radio" name="ex-sk" value="' + k + '"' + (i === 0 ? " checked" : "") + "> " + k + "</label>").join("") +
      "</fieldset>" +
      '<svg class="plot" role="img"></svg>' +
      '<p class="legend small"><span class="swatch sw-euler" aria-hidden="true"></span>Euler\'s values <span class="swatch sw-exact" aria-hidden="true"></span>true reading</p>' +
      '<p class="readout" aria-live="polite"></p>';
    L.renderMath(root);
    const svg = root.querySelector("svg"), readout = root.querySelector(".readout");
    function run(k) {
      const n = Math.round(T / k), pts = [[0, 0]];
      let y = 0, worst = 0;
      for (let j = 0; j < n; j++) {
        y += k * (-lam * (y - Math.cos(j * k)));
        const t = (j + 1) * k;
        pts.push([t, y]);
        if (t >= 1) worst = Math.max(worst, Math.abs(y - exact(t)));
      }
      const p = P.make(svg, { x: [0, T], y: [-1.5, 1.5], xticks: [0, 0.5, 1, 1.5, 2, 2.5, 3], yticks: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5], xlabel: "time t (hours)", ylabel: "reading y", clip: true });
      p.seg(0, 0, T, 0, "axis0");
      p.curve(exact, 0, T, 300, "exact");
      p.path(pts.map(q => [q[0], Math.max(-50, Math.min(50, q[1]))]), "euler thin faint");
      if (n <= 80) pts.forEach(q => { if (Math.abs(q[1]) <= 1.6) p.dot(q[0], q[1], "euler-pt", 2.6); });
      const lk = r6(lam * k), stable = lk < 2;
      readout.textContent = "Step " + k + ": " + n + " steps, rk = " + fmtD(lk) + (stable ? " (below 2: stable)" : " (above 2: unstable)") +
        ". From t = 1 to t = 3, the largest gap between Euler's values and the true reading is " + big(worst) + ".";
      svg.setAttribute("aria-label", "The true reading rises quickly from 0 to about 1, then follows the slow cosine curve down through 0 near t = 1.6 to about −1 at t = 3. " +
        (stable ? "Euler's values with step " + k + " follow it closely" + (lk > 1.5 ? " after some early zig-zags." : ".") : "Euler's values with step " + k + " zig-zag around it with growing swings and leave the chart."));
    }
    root.querySelectorAll('input[name="ex-sk"]').forEach(r => r.addEventListener("change", () => run(Number(r.value))));
    run(KS[0]);
  }

  /* ---------------- generators ---------------- */
  const LAMS = [0.5, 1, 2, 4, 5, 10, 20, 50];
  function lamK(lks) {
    let lam, lk, k;
    do { lam = pick(LAMS); lk = pick(lks); k = r6(lk / lam); } while (String(k).length > 6);
    return { lam, lk, k };
  }

  function genFactor() {
    const { lam, lk, k } = lamK([0.2, 0.5, 0.8, 1.2, 1.5, 2.5, 3]);
    const g = r6(1 - lk);
    return {
      prompt: "<p>Euler's method is used on $y' = " + lamY(lam) + "$ with step $k = " + fmtD(k) + "$. What is the amplification factor $\\kappa$, the number each step multiplies $y$ by?</p>",
      kind: "numbers", labels: ["$\\kappa =$"], answer: [g], tol: TOL,
      hint: "For the test problem $y' = -ry$, one Euler step is $y_{j+1} = (1 - rk)\\, y_j$.",
      review: { href: "#lesson1", label: "Lesson 1, What Euler's method does to it" },
      diagnose: v => {
        const x = v[0];
        if (near(x, lk, TOL)) return "That is $rk$. The factor is $1 - rk$.";
        if (near(x, 1 + lk, TOL)) return "Check the sign: the equation has $-r$, so the step subtracts.";
        if (near(x, r6(1 / (1 + lk)), TOL)) return "That is the factor for backward Euler. This question is about Euler's method.";
        return null;
      },
      explain: "<p>$rk = " + fmtD(lam) + " \\times " + fmtD(k) + " = " + fmtD(lk) + "$, so $\\kappa = 1 - " + fmtD(lk) + " = " + fmtD(g) + "$. The values " + behaviour(lk) + ".</p>",
    };
  }

  function genThree() {
    const { lam, lk, k } = lamK([0.2, 0.5, 1.5, 2.5, 3]);
    const g = r6(1 - lk), y0 = pick([1, 2, 10]), y3 = r6(y0 * g * g * g);
    return {
      prompt: "<p>Euler's method is used on $y' = " + lamY(lam) + "$, $y(0) = " + y0 + "$, with step $k = " + fmtD(k) + "$. What is $y_3$, the value after three steps?</p>",
      kind: "numbers", labels: ["$y_3 =$"], answer: [y3], tol: TOL,
      hint: "Find the amplification factor $\\kappa = 1 - rk$ first. Each step multiplies by $\\kappa$.",
      review: { href: "#lesson1", label: "Lesson 1, What Euler's method does to it" },
      diagnose: v => {
        const x = v[0];
        if (near(x, y0 * g, TOL)) return "That is the value after one step. Each of the three steps multiplies by the same factor.";
        if (g < 0 && near(x, -y3, TOL)) return "Check the sign. A negative factor flips the sign at every step; after three steps, is the sign flipped or not?";
        if (near(x, r6(y0 * Math.exp(-3 * lk)), 0.002)) return "That is the true solution at $t = 3k$. The question asks for Euler's value.";
        return null;
      },
      explain: "<p>$\\kappa = 1 - " + fmtD(lam) + " \\times " + fmtD(k) + " = " + fmtD(g) + "$, so $y_3 = \\kappa^3 y_0 = (" + fmtD(g) + ")^3 \\times " + y0 + " = " + fmtD(y3) + "$." +
        (Math.abs(g) > 1 ? " The true solution decays, but Euler's values grow: the step is too large." : "") + "</p>",
    };
  }

  function genMaxStep() {
    const kind = pick(["test", "test", "cool", "fall", "thermo"]);
    let tex, lam;
    if (kind === "test") { lam = pick([0.5, 2, 4, 5, 8, 10, 25, 100]); tex = "y' = -" + fmtD(lam) + "\\,y"; }
    else if (kind === "cool") { lam = pick([0.05, 0.1, 0.2, 0.25]); tex = "y' = -" + fmtD(lam) + "\\,(y - " + pick([18, 20, 22]) + ")"; }
    else if (kind === "fall") { lam = pick([0.1, 0.2, 0.25, 0.5]); tex = "v' = 9.8 - " + fmtD(lam) + "\\,v"; }
    else { lam = pick([20, 40, 80, 100]); tex = "y' = -" + lam + "\\,(y - \\cos t)"; }
    const ans = r6(2 / lam);
    return {
      prompt: "<p>Euler's method is used on $" + tex + "$. It is stable when the step $k$ is below a certain limit, and blows up for larger steps. What is that limit?</p>",
      kind: "numbers", labels: ["stable when $k <$"], answer: [ans], tol: Math.max(0.0011, ans * 0.005),
      hint: "Find the rate $r$: the number multiplying the unknown, with the minus sign removed. Then use the limit for the test problem.",
      review: { href: "#lesson1", label: "Lesson 1, the stability limit" },
      diagnose: v => {
        const x = v[0];
        if (near(x, 1 / lam, Math.max(0.0011, ans * 0.005))) return "That is the step where $\\kappa = 0$. Stability fails where $\\kappa$ passes $-1$.";
        if (near(x, lam / 2, 0.01) || near(x, 2 * lam, 0.01)) return "Check how $r$ enters the limit: a faster process (larger $r$) needs a smaller step.";
        return null;
      },
      explain: "<p>Here $r = " + fmtD(lam) + "$" + (kind === "test" ? "" : ": the distance to the steady state obeys the test problem with this rate") + ". Euler's method is stable when $k < 2/r = 2/" + fmtD(lam) + " = " + fmtD(ans) + "$.</p>",
    };
  }

  const BEHAVIOURS = [
    { html: "Shrinks steadily toward 0", range: "between 0 and 1", test: lk => lk < 1 },
    { html: "Flips sign every step, but shrinks", range: "between −1 and 0", test: lk => lk > 1 && lk < 2 },
    { html: "Flips sign forever without shrinking", range: "exactly −1", test: lk => lk === 2 },
    { html: "Flips sign and grows", range: "less than −1", test: lk => lk > 2 },
  ];
  function genClassify() {
    const { lam, lk, k } = lamK([0.25, 0.5, 0.8, 1.25, 1.5, 1.8, 2, 2.5, 3, 4]);
    const right = BEHAVIOURS.findIndex(b => b.test(lk));
    return {
      prompt: "<p>Euler's method is used on $y' = " + lamY(lam) + "$, $y(0) = 1$, with step $k = " + fmtD(k) + "$. What do the computed values do?</p>",
      kind: "mc", answer: right,
      options: BEHAVIOURS.map((b, i) => ({ html: b.html, why: i === right ? null : "That is what happens when $\\kappa = 1 - rk$ is " + b.range + ". Work out $\\kappa$ for this step." })),
      review: { href: "#lesson1", label: "Lesson 1, the table of cases" },
      explain: "<p>$\\kappa = 1 - " + fmtD(lam) + " \\times " + fmtD(k) + " = " + fmtD(1 - lk) + "$, so the values " + behaviour(lk) + ".</p>",
    };
  }

  function genSafe() {
    const lam = pick([4, 5, 10, 20, 50, 100]), lim = 2 / lam;
    const good = r6(lim * pick([0.25, 0.5, 0.75]));
    const bads = shuffle([1.25, 1.5, 2, 3, 5]).slice(0, 3).map(f => r6(lim * f));
    const opts = [good].concat(bads);
    return {
      prompt: "<p>Euler's method is used on $y' = -" + lam + "\\,y$. Which step gives a stable computation?</p>",
      kind: "mc", answer: 0,
      options: opts.map((k, i) => ({ html: "$k = " + fmtD(k) + "$", why: i === 0 ? null : "With this step, $rk = " + fmtD(lam * k) + "$. Compare that with 2." })),
      review: { href: "#lesson1", label: "Lesson 1, the stability limit" },
      explain: "<p>Stability needs $k < 2/r = 2/" + lam + " = " + fmtD(lim) + "$. Only $k = " + fmtD(good) + "$ is below that limit.</p>",
    };
  }

  const CONCEPTS = [
    () => ({
      prompt: "<p>Euler's method on $y' = -ry$ with $rk = 1.5$ gives values that flip sign every step but shrink toward 0. Which describes this computation?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "Stable, but not accurate", why: null },
        { html: "Stable and accurate", why: "The true solution never changes sign. Do these values look like it?" },
        { html: "Unstable, but accurate", why: "Unstable means the values grow. Do they?" },
        { html: "Unstable and not accurate", why: "Unstable means the values grow. Do they?" },
      ],
      review: { href: "#lesson1", label: "Lesson 1, after the explorer" },
      explain: "<p>The values decay, so the computation is stable: $|\\kappa| = 0.5 < 1$. But the true solution is always positive and decays smoothly, so values that flip sign are far from it: not accurate.</p>",
    }),
    () => ({
      prompt: "<p>What makes an ODE problem <strong>stiff</strong>?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "A fast process forces a tiny step for stability, even where the solution is smooth", why: null },
        { html: "The solution changes very quickly everywhere", why: "Then small steps would be needed for accuracy anyway. Think about the thermometer after its fast start." },
        { html: "The equation has no formula for its solution", why: "Most equations have none. That is not what stiff means." },
        { html: "The solution grows without bound", why: "In the thermometer example the true solution stays bounded and smooth." },
      ],
      review: { href: "#lesson2", label: "Lesson 2, Fast and slow" },
      explain: "<p>In a stiff problem the step is limited by stability (by the fast rate $r$), not by the accuracy you need: the thermometer's reading is smooth after the first minutes, but Euler still needs $k < 0.04$.</p>",
    }),
    () => ({
      prompt: "<p>Compared with Euler's method, what is true of backward Euler on the test problem $y' = -ry$?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "Its values decay for every step size, but each step needs an equation to be solved", why: null },
        { html: "It is stable only when $k < 2/r$", why: "Work out its factor $1/(1 + rk)$ for a large step, say $rk = 10$." },
        { html: "It needs no extra work per step", why: "Look at where $y_{j+1}$ appears in its formula." },
        { html: "It gives the exact solution", why: "Compare its factor $1/(1 + rk)$ with the exact factor $e^{-rk}$." },
      ],
      review: { href: "#lesson3", label: "Lesson 3, What to do about it" },
      explain: "<p>Backward Euler multiplies by $1/(1 + rk)$, which is between 0 and 1 for every $k > 0$, so it never blows up here. But $y_{j+1}$ appears on both sides of its formula, so each step means solving an equation.</p>",
    }),
  ];

  /* ---------------- quick checks ---------------- */
  const QC1 = {
    prompt: "<p>Euler's method is used on $y' = -4y$ with step $k = 0.75$. What is the amplification factor $\\kappa$?</p>",
    kind: "numbers", labels: ["$\\kappa =$"], answer: [-2], tol: TOL,
    hint: "$\\kappa = 1 - rk$. What is $r$ here?",
    diagnose: v => {
      if (near(v[0], 3, TOL)) return "That is $rk$. The factor is $1 - rk$.";
      if (near(v[0], 4, TOL)) return "Check the sign: the step subtracts $rk$ from 1.";
      if (near(v[0], 2, TOL)) return "Check the sign of $1 - rk$.";
      return null;
    },
    explain: "<p>$rk = 4 \\times 0.75 = 3$, so $\\kappa = 1 - 3 = -2$. Each step flips the sign and doubles the size: this step is unstable, since $2/r = 0.5$.</p>",
  };
  const QC2 = {
    prompt: "<p>The drug from Module 1 obeys $y' = -0.13\\,y$ (time in hours). Euler's method is stable when the step $k$, in hours, is below what limit? Give at least two decimal places.</p>",
    kind: "numbers", labels: ["stable when $k <$"], answer: [r6(2 / 0.13)], tol: 0.006,
    hint: "Here $r = 0.13$. Use the limit from Lesson 1.",
    diagnose: v => {
      if (near(v[0], 1 / 0.13, 0.01)) return "That is the step where $\\kappa = 0$. Stability fails where $\\kappa$ passes $-1$.";
      if (near(v[0], 0.26, 0.005) || near(v[0], 0.065, 0.002)) return "The limit is $2$ divided by $r$.";
      return null;
    },
    explain: "<p>$k < 2/r = 2/0.13 \\approx 15.38$ hours. The drug is slow, so the limit is generous: any step accurate enough to be useful is far below it.</p>",
  };

  document.addEventListener("DOMContentLoaded", () => {
    explorerTest(document.getElementById("ex-test"));
    explorerStiff(document.getElementById("ex-stiff"));
    L.quick(document.getElementById("qc1"), QC1);
    L.quick(document.getElementById("qc2"), QC2);
    L.quick(document.getElementById("qc3"), CONCEPTS[2]());
    L.practice(document.getElementById("practice"), [genFactor, genThree, genMaxStep, genClassify, genSafe, () => pick(CONCEPTS)()]);
    L.moduleCheck(document.getElementById("check"), "m03", () => [pick([genFactor, genThree])(), genMaxStep(), genClassify(), genSafe(), pick(CONCEPTS)()]);
    L.renderMath(document.getElementById("main"));
  });
})();
