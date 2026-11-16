/* Module 2 — Euler's method: figures, stepping explorer, quick checks, practice and module check. */
(function () {
  "use strict";
  const L = window.LAR, P = window.ODEPlot;
  const { randInt, pick, shuffle } = L;

  /* ---------------- number formatting ---------------- */
  const r6 = x => Math.round(x * 1e6) / 1e6;
  function fmtD(x) { x = r6(x); return Object.is(x, -0) ? "0" : String(x); }
  const par = x => (r6(x) < 0 ? "(" + fmtD(x) + ")" : fmtD(x));
  const plain = (x, d) => { const s = String(Math.round(x * Math.pow(10, d)) / Math.pow(10, d)); return s.replace("-", "−"); };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const TOL = 0.002;

  /* the coffee problem */
  const cool = (t, y) => -0.1 * (y - 20);
  const exact = t => 20 + 70 * Math.exp(-0.1 * t);

  /* ---------------- static figures ---------------- */
  function figOneStep() {
    const svg = document.getElementById("fig-onestep");
    if (!svg) return;
    const p = P.make(svg, { x: [0, 6], y: [55, 95], xticks: [0, 1, 2, 3, 4, 5, 6], yticks: [60, 70, 80, 90], xlabel: "time t (minutes)", ylabel: "temperature y (°C)" });
    p.curve(exact, 0, 6, 80, "exact");
    p.seg(0, 90, 4, 62, "euler");
    p.seg(4, 62, 4, exact(4), "gap");
    p.dot(0, 90, "start-pt", 5);
    p.dot(4, 62, "euler-pt", 5);
    p.dot(4, exact(4), "exact-pt", 5);
    p.label(0, 90, "(t₀, y₀)", "", 8, -6);
    p.label(2, 76, "slope −7", "c1-text", -6, 18, "end");
    p.label(4, 62, "y₁ = 62", "c1-text", 9, 5);
    p.label(4, exact(4), "true y(4) ≈ 66.9", "c2-text", 9, -4);
    p.label(4, (62 + exact(4)) / 2, "error", "res-text", -7, 4, "end");
  }

  function eulerAt(k, T) { let y = 90; const n = Math.round(T / k); for (let j = 0; j < n; j++) y += k * cool(j * k, y); return y; }

  function figLogLog() {
    const svg = document.getElementById("fig-loglog");
    if (!svg) return;
    const p = P.make(svg, { x: [0.1, 3], y: [0.1, 5], xlog: true, ylog: true, xticks: [0.125, 0.25, 0.5, 1, 2], yticks: [0.1, 0.2, 0.5, 1, 2], xlabel: "step k (log scale)", ylabel: "error at t = 10 (log scale)" });
    const ks = [0.125, 0.25, 0.5, 1, 2];
    const pts = ks.map(k => [k, exact(10) - eulerAt(k, 10)]);
    p.path([[0.11, 0.11 * 2.6], [1.6, 1.6 * 2.6]], "ref");
    p.label(0.3, 0.3 * 2.6, "slope 1", "muted-text", -6, -6, "end");
    p.path(pts, "euler");
    pts.forEach(q => p.dot(q[0], q[1], "euler-pt", 4.5));
    p.label(2, pts[4][1], "Euler", "c1-text", -8, 18, "end");
  }

  /* ---------------- explorer ---------------- */
  function explorer(root) {
    const T = 10, KS = [5, 2.5, 1, 0.5];
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.innerHTML =
      '<fieldset class="kpick"><legend>Step size $k$</legend>' +
      KS.map((k, i) => '<label><input type="radio" name="ex-k" value="' + k + '"' + (i === 0 ? " checked" : "") + "> " + k + "</label>").join("") +
      "</fieldset>" +
      '<div class="buttons"><button type="button" data-act="step">One step</button><button type="button" class="secondary" data-act="run">Run to t = 10</button><button type="button" class="secondary" data-act="reset">Start over</button></div>' +
      '<p class="small" style="margin:0.6rem 0 0"><label><input type="checkbox" data-act="exact" checked> Show the exact solution</label></p>' +
      '<svg class="plot" role="img"></svg>' +
      '<p class="legend small"><span class="swatch sw-euler" aria-hidden="true"></span>Euler\'s steps <span class="swatch sw-exact" aria-hidden="true"></span>exact solution</p>' +
      '<p class="readout" aria-live="polite"></p>' +
      '<div class="table-wrap" hidden><table><caption>Your runs to $t = 10$ (the exact value is ' + plain(exact(10), 2) + ')</caption>' +
      '<thead><tr><th scope="col">step $k$</th><th scope="col">steps</th><th scope="col">Euler at $t = 10$</th><th scope="col">error</th></tr></thead><tbody></tbody></table></div>';
    L.renderMath(root);
    const svg = root.querySelector("svg"), readout = root.querySelector(".readout");
    const btnStep = root.querySelector('[data-act="step"]'), btnRun = root.querySelector('[data-act="run"]'), btnReset = root.querySelector('[data-act="reset"]');
    const chkExact = root.querySelector('[data-act="exact"]');
    const tableWrap = root.querySelector(".table-wrap"), tbody = root.querySelector("tbody");
    const runs = new Map();
    let k = KS[0], ys = [90], timer = null;
    const N = () => Math.round(T / k);

    function draw() {
      const p = P.make(svg, { x: [0, 10], y: [20, 95], xticks: [0, 2, 4, 6, 8, 10], yticks: [20, 40, 60, 80], xlabel: "time t (minutes)", ylabel: "temperature y (°C)" });
      if (chkExact.checked) p.curve(exact, 0, 10, 120, "exact");
      const pts = ys.map((y, j) => [j * k, y]);
      if (pts.length > 1) p.path(pts, "euler");
      pts.forEach((q, j) => p.dot(q[0], q[1], j === 0 ? "start-pt" : "euler-pt", j === pts.length - 1 && j > 0 ? 5.5 : 4));
      if (ys.length - 1 === N()) {
        p.seg(10, ys[ys.length - 1], 10, exact(10), "gap");
        if (exact(10) - ys[ys.length - 1] > 2) p.label(10, (ys[ys.length - 1] + exact(10)) / 2, "error", "res-text", -7, 4, "end");
      }
      const j = ys.length - 1;
      svg.setAttribute("aria-label", "Cooling curve from 90 degrees at time 0 toward 20 degrees. " + (chkExact.checked ? "The exact solution is shown. " : "") +
        "Euler's method with step " + k + ": " + j + " of " + N() + " steps taken; the latest point is at time " + plain(j * k, 2) + ", temperature " + plain(ys[j], 2) + ".");
    }
    /* buttons are never disabled while focused (that would drop keyboard focus); they are marked aria-disabled instead */
    function setBusy(b) { [btnStep, btnRun].forEach(x => x.setAttribute("aria-disabled", b ? "true" : "false")); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } setBusy(false); }
    function finished() { return ys.length - 1 >= N(); }
    function step(quiet) {
      if (finished()) return;
      const j = ys.length - 1, t = j * k, y = ys[j], s = cool(t, y), yn = y + k * s;
      ys.push(yn);
      if (!quiet) readout.textContent = "Step " + (j + 1) + ": the slope at t = " + plain(t, 2) + ", y = " + plain(y, 3) + " is " + plain(s, 3) + ", so y = " + plain(y, 3) + " + " + k + " × (" + plain(s, 3) + ") = " + plain(yn, 3) + " at t = " + plain(t + k, 2) + ".";
      if (finished()) complete();
      draw();
    }
    function complete() {
      stop();
      const yT = ys[ys.length - 1], err = exact(10) - yT;
      setBusy(true);
      if (document.activeElement === btnStep || document.activeElement === btnRun) btnReset.focus();
      readout.textContent = "Reached t = 10 after " + N() + " steps. Euler gives " + plain(yT, 2) + " °C; the exact value is " + plain(exact(10), 2) + " °C. Error: " + plain(err, 2) + " °C.";
      runs.set(k, { n: N(), y: yT, err });
      tbody.innerHTML = [...runs.entries()].sort((a, b) => b[0] - a[0]).map(([kk, r]) => "<tr><td>" + kk + "</td><td>" + r.n + "</td><td>" + plain(r.y, 2) + "</td><td>" + plain(r.err, 2) + "</td></tr>").join("");
      tableWrap.hidden = false;
    }
    function reset() {
      stop(); ys = [90];
      readout.textContent = "Start: t = 0, y = 90. Step size k = " + k + ", so " + N() + " steps reach t = 10.";
      draw();
    }
    btnStep.addEventListener("click", () => { if (!timer) step(false); });
    btnRun.addEventListener("click", () => {
      if (finished() || timer) return;
      if (reduce) { while (!finished()) step(true); return; }
      setBusy(true);
      readout.textContent = "Running to t = 10 with step " + k + "…";
      timer = setInterval(() => step(true), Math.max(60, 1200 / N()));
    });
    btnReset.addEventListener("click", reset);
    chkExact.addEventListener("change", draw);
    root.querySelectorAll('input[name="ex-k"]').forEach(r => r.addEventListener("change", () => { k = Number(r.value); reset(); }));
    reset();
  }

  /* ---------------- slope functions for generated problems ---------------- */
  const coef = a => (a === 1 ? "" : a === -1 ? "-" : fmtD(a));
  function family() {
    const kind = pick(["exp", "exp", "tpy", "tmy", "ymt", "2tmy", "ty", "cool", "cool"]);
    if (kind === "exp") {
      const a = pick([-2, -1, -0.5, 0.5, 1, 2, 3]);
      return { tex: "y' = " + coef(a) + "y", f: (t, y) => a * y, show: (t, y) => fmtD(a) + " \\times " + par(y), tdep: false, t0: 0, y0: randInt(1, 5), k: pick([0.1, 0.2, 0.5]) };
    }
    if (kind === "cool") {
      const c = pick([0.1, 0.2, 0.5]), R = pick([20, 10, 0]), y0 = pick([50, 60, 80, 90, 100]);
      const tex = R === 0 ? "y' = -" + fmtD(c) + "\\,y" : "y' = -" + fmtD(c) + "\\,(y - " + R + ")";
      const show = R === 0 ? (t, y) => "-" + fmtD(c) + " \\times " + par(y) : (t, y) => "-" + fmtD(c) + " \\times (" + fmtD(y) + " - " + R + ")";
      return { tex, f: (t, y) => -c * (y - R), show, tdep: false, t0: 0, y0, k: pick([0.5, 1, 2]) };
    }
    const t0 = kind === "ty" ? pick([1, 2]) : pick([0, 1, 2]), y0 = randInt(1, 4), k = pick([0.1, 0.2, 0.5]);
    const F = {
      tpy: { tex: "y' = t + y", f: (t, y) => t + y, show: (t, y) => fmtD(t) + " + " + par(y) },
      tmy: { tex: "y' = t - y", f: (t, y) => t - y, show: (t, y) => fmtD(t) + " - " + par(y) },
      ymt: { tex: "y' = y - t", f: (t, y) => y - t, show: (t, y) => fmtD(y) + " - " + par(t) },
      "2tmy": { tex: "y' = 2t - y", f: (t, y) => 2 * t - y, show: (t, y) => "2 \\times " + par(t) + " - " + par(y) },
      ty: { tex: "y' = t\\,y", f: (t, y) => t * y, show: (t, y) => par(t) + " \\times " + par(y) },
    }[kind];
    return Object.assign({ tdep: true, t0, y0, k: kind === "ty" ? pick([0.1, 0.5]) : k }, F);
  }

  /* ---------------- generators ---------------- */
  function genOneStep() {
    const q = family(), s0 = q.f(q.t0, q.y0), ans = q.y0 + q.k * s0;
    const sEnd = q.f(q.t0 + q.k, q.y0);
    return {
      prompt: "<p>Take one Euler step with $k = " + q.k + "$ for</p><div class=\"display\">" + "$$" + q.tex + ", \\qquad y(" + q.t0 + ") = " + q.y0 + ".$$</div><p>What is $y_1$, the approximation at $t_1 = " + fmtD(q.t0 + q.k) + "$?</p>",
      kind: "numbers", labels: ["$y_1 =$"], answer: [r6(ans)], tol: TOL,
      hint: "Work out the slope $f(t_0, y_0)$ at the starting point, multiply it by the step $k$, and add the result to $y_0$.",
      review: { href: "#lesson1", label: "Lesson 1, Follow the slope" },
      diagnose: v => {
        const x = v[0];
        if (q.k !== 1 && near(x, q.y0 + s0, TOL)) return "It looks like the slope was added without multiplying it by the step $k = " + q.k + "$.";
        if (near(x, q.k * s0, TOL) && !near(q.k * s0, ans, TOL)) return "That is the change in $y$ over the step. The new value is the old value plus that change.";
        if (near(x, q.y0 - q.k * s0, TOL) && s0 !== 0) return "Check the sign of the slope: Euler adds $k \\times f(t_0, y_0)$, and here the slope is " + (s0 < 0 ? "negative" : "positive") + ".";
        if (q.tdep && near(x, q.y0 + q.k * sEnd, TOL) && !near(sEnd, s0, 1e-9)) return "The slope should be evaluated at the start of the step, at $t_0 = " + q.t0 + "$, not at the end.";
        return null;
      },
      explain: "<p>The slope at the start is $f(" + q.t0 + ", " + q.y0 + ") = " + q.show(q.t0, q.y0) + " = " + fmtD(s0) + "$, so</p><div class=\"display\">$$y_1 = " + q.y0 + " + " + q.k + " \\times " + par(s0) + " = " + fmtD(ans) + ".$$</div>",
    };
  }

  function genTwoSteps() {
    let q, s0, y1, s1, y2;
    do {
      q = family(); s0 = q.f(q.t0, q.y0); y1 = q.y0 + q.k * s0;
      s1 = q.f(q.t0 + q.k, y1); y2 = y1 + q.k * s1;
    } while (Math.abs(s1 - s0) < 1e-6 || Math.abs(y2) > 1000);
    const t1 = r6(q.t0 + q.k), t2 = r6(q.t0 + 2 * q.k);
    const sStale = q.f(q.t0, y1);
    return {
      prompt: "<p>Take two Euler steps with $k = " + q.k + "$ for</p><div class=\"display\">$$" + q.tex + ", \\qquad y(" + q.t0 + ") = " + q.y0 + ".$$</div><p>Give $y_1$ (at $t_1 = " + fmtD(t1) + "$) and $y_2$ (at $t_2 = " + fmtD(t2) + "$), to at least 3 decimal places.</p>",
      kind: "numbers", labels: ["$y_1 =$", "$y_2 =$"], answer: [r6(y1), r6(y2)], tol: TOL,
      hint: "Do one step at a time. The second step starts from $(t_1, y_1)$ and needs a new slope, $f(t_1, y_1)$.",
      review: { href: "#lesson2", label: "Lesson 2, Step after step" },
      diagnose: v => {
        if (!near(v[0], y1, TOL)) return "Check $y_1$ first: slope at $(t_0, y_0)$, times $k$, added to $y_0$. The second step builds on it.";
        if (near(v[1], y1 + q.k * s0, TOL)) return "$y_1$ is right. For the second step the slope has to be recomputed at the new point $(t_1, y_1)$; it is not the same as the first slope.";
        if (q.tdep && near(v[1], y1 + q.k * sStale, TOL)) return "$y_1$ is right. In the second slope, use the new time $t_1 = " + fmtD(t1) + "$ as well as the new value $y_1$.";
        if (q.k !== 1 && near(v[1], y1 + s1, TOL)) return "$y_1$ is right. In the second step, remember to multiply the slope by $k$.";
        return "$y_1$ is right. Recheck the second step: the slope at $(t_1, y_1)$, times $k$, added to $y_1$.";
      },
      explain: "<p>Step 1: $f(" + q.t0 + ", " + q.y0 + ") = " + q.show(q.t0, q.y0) + " = " + fmtD(s0) + "$, so $y_1 = " + q.y0 + " + " + q.k + " \\times " + par(s0) + " = " + fmtD(y1) + "$.</p>" +
        "<p>Step 2: $f(" + fmtD(t1) + ", " + fmtD(y1) + ") = " + q.show(t1, y1) + " = " + fmtD(s1) + "$, so $y_2 = " + fmtD(y1) + " + " + q.k + " \\times " + par(s1) + " = " + fmtD(y2) + "$.</p>",
    };
  }

  function genScale() {
    const k1 = pick([0.1, 0.2, 0.4, 0.5, 0.05]);
    const factor = pick([2, 4, 5, 10, 0.5]);
    const k2 = r6(k1 / factor);
    const E1 = pick([0.03, 0.06, 0.08, 0.12, 0.2, 0.5, 1.2]);
    const ans = r6(E1 / factor);
    const T = pick([1, 2, 5, 10]);
    return {
      prompt: "<p>Euler's method with step $k = " + k1 + "$ gives an error of $" + E1 + "$ at $t = " + T + "$. Estimate the error at $t = " + T + "$ with step $k = " + k2 + "$.</p>",
      kind: "numbers", labels: ["error ≈"], answer: [ans], tol: Math.abs(ans) * 0.02,
      hint: "Euler's method is first order: the error at a fixed time is proportional to the step $k$.",
      review: { href: "#lesson3", label: "Lesson 3, How big is the error?" },
      diagnose: v => {
        const x = v[0];
        if (near(x, E1 / (factor * factor), Math.abs(E1 / (factor * factor)) * 0.02)) return "That would be right for a method whose error is proportional to $k^2$. Euler's error is proportional to $k$.";
        if (near(x, E1 * factor, Math.abs(E1 * factor) * 0.02) && factor !== 1) return "Compare the two steps: is the new step smaller or larger? The error moves the same way as the step.";
        return null;
      },
      explain: "<p>The step changes by a factor of $" + fmtD(k2) + " / " + k1 + " = " + fmtD(1 / factor) + "$, and the error is proportional to $k$, so the error is about $" + E1 + " \\times " + fmtD(1 / factor) + " = " + fmtD(ans) + "$.</p>",
    };
  }

  function genSteps() {
    const T = pick([1, 2, 3, 5, 10]), k = pick([0.1, 0.05, 0.02, 0.25, 0.01]);
    const n = Math.round(T / k);
    return {
      prompt: "<p>You run Euler's method from $t = 0$ to $t = " + T + "$ with step $k = " + k + "$. Each step evaluates the slope $f$ once.</p>",
      kind: "numbers", labels: ["How many steps?", "If you halve the step, how many evaluations of $f$ does the run take?"], answer: [n, 2 * n],
      hint: "The number of steps is the length of the time interval divided by the step.",
      review: { href: "#lesson2", label: "Lesson 2, Step after step" },
      diagnose: v => (near(v[0], n, 0.5) ? "The number of steps is right. With half the step, it takes twice as many steps to cover the same time, and each needs one slope." : null),
      explain: "<p>$" + T + " / " + k + " = " + n + "$ steps. Halving the step doubles that: $" + 2 * n + "$ steps, so $" + 2 * n + "$ evaluations of $f$.</p>",
    };
  }

  const CONCEPTS_A = [
    () => ({
      prompt: "<p>In Euler's update $y_{j+1} = y_j + k\\, f(t_j, y_j)$, which slope is used for the whole step from $t_j$ to $t_{j+1}$?</p>",
      kind: "mc",
      options: [
        { html: "The slope at the start of the step, $(t_j, y_j)$", why: null },
        { html: "The slope at the end of the step, $(t_{j+1}, y_{j+1})$", why: "The end point is what the step is trying to find, so its slope is not known yet." },
        { html: "The slope halfway through the step", why: "Look at the formula: which time and which value go into $f$?" },
        { html: "The average of the slopes at the start and the end", why: "Averaging slopes gives a better method, which Module 4 covers. Euler uses one slope." },
      ],
      answer: 0,
      review: { href: "#lesson1", label: "Lesson 1, Follow the slope" },
      explain: "<p>Euler's method knows only the point it is at, so it uses the slope there, $f(t_j, y_j)$, for the whole step: it follows the tangent line.</p>",
    }),
    () => ({
      prompt: "<p>In Euler's method, what is $y_j$?</p>",
      kind: "mc",
      options: [
        { html: "The computed approximation to the true value $y(t_j)$", why: null },
        { html: "The exact value $y(t_j)$", why: "Look back at the table in Lesson 2 and compare the computed values with the true ones." },
        { html: "The slope of the solution at $t_j$", why: "The slope at that point is $f(t_j, y_j)$." },
        { html: "The change in $y$ during step $j$", why: "The change during the step is $k\\, f(t_j, y_j)$." },
      ],
      answer: 0,
      review: { href: "#lesson1", label: "Lesson 1, Follow the slope" },
      explain: "<p>$y_j$ is what the method computes at time $t_j$. It approximates the true value $y(t_j)$; only $y_0$ is exact.</p>",
    }),
  ];
  const CONCEPTS_B = [
    () => ({
      prompt: "<p>For one problem, Euler's method with $k = 0.01$ gives an answer correct to 2 decimal places. Roughly how much more work would it take to get 4 correct decimal places?</p>",
      kind: "mc",
      options: [
        { html: "About 100 times as many steps", why: null },
        { html: "About 2 times as many steps", why: "Each halving of the step only halves the error. You need the error about 100 times smaller." },
        { html: "About 10 times as many steps", why: "A step 10 times smaller makes the error 10 times smaller: one more correct digit. You want two more." },
        { html: "About 4 times as many steps", why: "A step 4 times smaller makes Euler's error about 4 times smaller. How much smaller does the error need to be for two more correct digits?" },
      ],
      answer: 0,
      review: { href: "#lesson3", label: "Lesson 3, What first order costs" },
      explain: "<p>Two more digits means an error about 100 times smaller. Euler's error is proportional to $k$, so the step must be about 100 times smaller, which takes about 100 times as many steps.</p>",
    }),
    () => ({
      prompt: "<p>For which of these equations does Euler's method give the exact solution, whatever the step $k$?</p>",
      kind: "mc",
      options: [
        { html: "$y' = 3$", why: null },
        { html: "$y' = y$", why: "The solution $y = Ce^t$ curves, so a straight step cannot follow it." },
        { html: "$y' = t$", why: "The solution $t^2/2 + C$ curves ($y'' = 1$), so a straight step cannot follow it." },
        { html: "$y' = -0.1(y - 20)$", why: "This is the coffee: Lesson 2 showed Euler's error growing step by step." },
      ],
      answer: 0,
      review: { href: "#lesson3", label: "Lesson 3, The error in one step" },
      explain: "<p>The truncation error comes from $y''$, the bending of the solution. For $y' = 3$ the solution is a straight line, so $y'' = 0$, and following the slope lands exactly on it.</p>",
    }),
  ];

  /* ---------------- quick checks (fixed numbers, tied to the coffee) ---------------- */
  const QC1 = {
    prompt: "<p>Take one Euler step for the coffee, $y' = -0.1\\,(y - 20)$, $y(0) = 90$, with step $k = 2$. What is $y_1$, the approximation at $t_1 = 2$?</p>",
    kind: "numbers", labels: ["$y_1 =$"], answer: [76], tol: TOL,
    hint: "The slope at the start is $f(0, 90)$. Multiply it by the step and add the result to $90$.",
    diagnose: v => {
      if (near(v[0], 83, TOL)) return "That follows the slope for 1 minute. The step here is $k = 2$ minutes.";
      if (near(v[0], -14, TOL) || near(v[0], 14, TOL)) return "That is the change in temperature over the step. The new value is the old value plus that change.";
      if (near(v[0], 104, TOL)) return "The coffee is cooling, so the temperature should go down. Check the sign of the slope.";
      return null;
    },
    explain: "<p>$f(0, 90) = -0.1 \\times (90 - 20) = -7$, so $y_1 = 90 + 2 \\times (-7) = 76$.</p>",
  };
  const QC2 = {
    prompt: "<p>Continue the coffee with $k = 2$. You have $y_1 = 76$ at $t_1 = 2$. What is $y_2$, the approximation at $t_2 = 4$?</p>",
    kind: "numbers", labels: ["$y_2 =$"], answer: [64.8], tol: TOL,
    hint: "Compute a new slope at the new point, $f(2, 76)$, then take a step of length 2 from $76$.",
    diagnose: v => {
      if (near(v[0], 62, TOL)) return "That reuses the first slope, $-7$. The slope must be recomputed at the new point: the coffee is cooler now, so it cools more slowly.";
      if (near(v[0], 70.4, TOL)) return "Remember to multiply the slope by the step $k = 2$.";
      if (near(Math.abs(v[0]), 11.2, TOL)) return "That is the change over the step. Add it to $y_1$.";
      return null;
    },
    explain: "<p>$f(2, 76) = -0.1 \\times (76 - 20) = -5.6$, so $y_2 = 76 + 2 \\times (-5.6) = 64.8$. (The true value is $y(4) \\approx 66.92$.)</p>",
  };
  const QC3 = {
    prompt: "<p>Euler's method with step $k = 0.2$ has an error of $0.06$ at $t = 5$. Estimate the error at $t = 5$ with step $k = 0.05$.</p>",
    kind: "numbers", labels: ["error ≈"], answer: [0.015], tol: 0.0003,
    hint: "The new step is 4 times smaller. How does Euler's error depend on the step?",
    diagnose: v => {
      if (near(v[0], 0.00375, 0.0001)) return "That would be right if the error were proportional to $k^2$. Euler's error is proportional to $k$.";
      if (near(v[0], 0.03, 0.0005)) return "The step was divided by 4, not 2.";
      if (near(v[0], 0.24, 0.002)) return "A smaller step should give a smaller error.";
      return null;
    },
    explain: "<p>The step is 4 times smaller, and the error is proportional to $k$, so the error is about $0.06 / 4 = 0.015$.</p>",
  };

  document.addEventListener("DOMContentLoaded", () => {
    figOneStep();
    figLogLog();
    explorer(document.getElementById("ex-euler"));
    L.quick(document.getElementById("qc1"), QC1);
    L.quick(document.getElementById("qc2"), QC2);
    L.quick(document.getElementById("qc3"), QC3);
    L.practice(document.getElementById("practice"), [genOneStep, genOneStep, genTwoSteps, genScale, genSteps, () => pick(CONCEPTS_A)(), () => pick(CONCEPTS_B)()]);
    L.moduleCheck(document.getElementById("check"), "m02", () => [genOneStep(), genTwoSteps(), genScale(), pick(CONCEPTS_A)(), pick(CONCEPTS_B)()]);
    L.renderMath(document.getElementById("main"));
  });
})();
