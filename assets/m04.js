/* Module 4 — Heun and RK4: figures, method-comparison explorer, quick checks, practice and module check. */
(function () {
  "use strict";
  const L = window.LAR, P = window.ODEPlot;
  const { randInt, pick, shuffle } = L;

  /* ---------------- number formatting ---------------- */
  const r6 = x => Math.round(x * 1e6) / 1e6;
  function fmtD(x) { x = r6(x); return Object.is(x, -0) ? "0" : String(x); }
  const par = x => (r6(x) < 0 ? "(" + fmtD(x) + ")" : fmtD(x));
  function sci(x) {
    const a = Math.abs(x);
    if (a >= 0.001) return String(Number(x.toPrecision(2)));
    const e = Math.floor(Math.log10(a)), m = x / Math.pow(10, e);
    return (Math.round(m * 10) / 10) + " × 10" + String(e).replace("-", "⁻").split("").map(c => ("⁻" === c ? c : "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)])).join("");
  }
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const TOL = 0.00011;

  /* ---------------- the three methods ---------------- */
  const METHODS = [
    { key: "E", name: "Euler", label: "Euler's method", cost: 1, order: 1, shape: "circle", cls: "m-euler" },
    { key: "H", name: "Heun", label: "Heun's method", cost: 2, order: 2, shape: "square", cls: "m-heun" },
    { key: "R", name: "RK4", label: "the classic RK4 method", cost: 4, order: 4, shape: "diamond", cls: "m-rk4" },
  ];
  function step(key, f, t, y, k) {
    if (key === "E") return y + k * f(t, y);
    if (key === "H") { const fj = f(t, y); return y + k / 2 * (fj + f(t + k, y + k * fj)); }
    const k1 = k * f(t, y), k2 = k * f(t + k / 2, y + k1 / 2), k3 = k * f(t + k / 2, y + k2 / 2), k4 = k * f(t + k, y + k3);
    return y + (k1 + 2 * k2 + 2 * k3 + k4) / 6;
  }
  function solve(key, f, y0, T, M) {
    const k = T / M, pts = [[0, y0]];
    let y = y0;
    for (let j = 0; j < M; j++) { y = step(key, f, j * k, y, k); pts.push([(j + 1) * k, y]); }
    return pts;
  }
  /* the logistic problem used in the explorer and in Lesson 3 */
  const logi = (t, y) => 10 * y * (1 - y);
  const logiExact = t => 0.01 / (0.01 + 0.99 * Math.exp(-10 * t));
  const maxErr = pts => Math.max(...pts.map(q => Math.abs(q[1] - logiExact(q[0]))));

  /* ---------------- figures ---------------- */
  function figHeun() {
    const svg = document.getElementById("fig-heun");
    if (!svg) return;
    const ex = t => 20 + 70 * Math.exp(-0.1 * t);
    const p = P.make(svg, { margin: { r: 78 }, x: [0, 5], y: [55, 95], xticks: [0, 1, 2, 3, 4, 5], yticks: [60, 70, 80, 90], xlabel: "time t (minutes)", ylabel: "temperature y (°C)" });
    p.curve(ex, 0, 5, 80, "exact");
    p.seg(0, 90, 4, 62, "pred");
    p.seg(3.3, 62 + 0.7 * 4.2, 4.7, 62 - 0.7 * 4.2, "slope2");
    p.seg(0, 90, 4, 67.6, "heun");
    p.dot(0, 90, "start-pt", 5);
    p.marker(4, 62, "circle", "pred-pt", 4.5);
    p.marker(4, 67.6, "square", "heun-pt", 5);
    p.label(0, 90, "(t₀, y₀)", "", 8, -6);
    p.label(4, 62, "Euler predicts 62", "c1-text", -10, 20, "end");
    p.label(3.3, 62 + 0.7 * 4.2, "slope −4.2", "muted-text", -6, 4, "end");
    p.label(4, 67.6, "Heun: 67.6", "heun-text", 10, 5);
    p.label(2.2, ex(2.2), "true curve", "c2-text", 6, -8);
  }


  /* ---------------- explorer ---------------- */
  function explorer(root) {
    const MS = [4, 5, 8, 10, 20, 40];
    root.innerHTML =
      '<p style="margin-top:0">The logistic equation $y\' = 10\\,y\\,(1 - y)$, $y(0) = 0.01$, solved up to $t = 1$ with $M$ steps of size $k = 1/M$.</p>' +
      '<fieldset class="kpick"><legend>Steps $M$</legend>' +
      MS.map(M => '<label><input type="radio" name="ex-M" value="' + M + '"' + (M === 10 ? " checked" : "") + "> " + M + "</label>").join("") +
      "</fieldset>" +
      '<fieldset class="kpick" style="margin-top:0.4rem"><legend>Show</legend>' +
      METHODS.map(m => '<label><input type="checkbox" name="ex-meth" value="' + m.key + '" checked> ' + m.name + "</label>").join("") +
      "</fieldset>" +
      '<svg class="plot" role="img"></svg>' +
      '<p class="legend small"><span class="swatch sw-exact" aria-hidden="true"></span>true solution ' +
      METHODS.map(m => '<span class="mkey ' + m.cls + '" aria-hidden="true">' + { circle: "●", square: "■", diamond: "◆" }[m.shape] + "</span>" + m.name).join(" ") + "</p>" +
      '<div class="table-wrap"><table><caption>Largest error at the step points, and the work done</caption>' +
      '<thead><tr><th scope="col">method</th><th scope="col">evaluations of $f$</th><th scope="col">largest error</th></tr></thead><tbody aria-live="polite"></tbody></table></div>';
    L.renderMath(root);
    const svg = root.querySelector("svg"), tbody = root.querySelector("tbody");
    function update() {
      const M = Number(root.querySelector('input[name="ex-M"]:checked').value);
      const on = new Set([...root.querySelectorAll('input[name="ex-meth"]:checked')].map(c => c.value));
      const p = P.make(svg, { x: [0, 1], y: [-0.1, 1.2], xticks: [0, 0.2, 0.4, 0.6, 0.8, 1], yticks: [0, 0.5, 1], xlabel: "time t", ylabel: "y", clip: true });
      p.curve(logiExact, 0, 1, 200, "exact");
      const rows = [], desc = [];
      METHODS.forEach(m => {
        const pts = solve(m.key, logi, 0.01, 1, M), err = maxErr(pts);
        rows.push("<tr><td>" + m.name + "</td><td>" + (m.cost * M) + "</td><td>" + sci(err) + "</td></tr>");
        if (!on.has(m.key)) return;
        p.path(pts, "series thin " + m.cls);
        pts.forEach(q => p.marker(q[0], q[1], m.shape, "mk " + m.cls, M > 20 ? 3 : 4));
        desc.push(m.name + " (largest error " + sci(err) + ")");
      });
      tbody.innerHTML = rows.join("");
      svg.setAttribute("aria-label", "The true solution is an S-shaped curve rising from 0.01 to about 1 between t = 0.2 and t = 0.7. With " + M + " steps: " + (desc.length ? desc.join("; ") : "no methods shown") + ".");
    }
    root.querySelectorAll("input").forEach(i => i.addEventListener("change", update));
    update();
  }

  /* ---------------- slope functions for generated problems ---------------- */
  const coef = a => (a === 1 ? "" : a === -1 ? "-" : fmtD(a));
  function family() {
    const kind = pick(["exp", "exp", "tpy", "tmy", "cool"]);
    if (kind === "exp") {
      const a = pick([-2, -1, -0.5, 0.5, 1, 2]);
      return { tex: "y' = " + coef(a) + "y", f: (t, y) => a * y, show: (t, y) => fmtD(a) + " \\times " + par(y), t0: 0, y0: randInt(1, 4), k: pick([0.1, 0.2, 0.5]) };
    }
    if (kind === "cool") {
      const c = pick([0.1, 0.2]), R = pick([20, 10]), y0 = pick([50, 60, 80, 90]);
      return { tex: "y' = -" + fmtD(c) + "\\,(y - " + R + ")", f: (t, y) => -c * (y - R), show: (t, y) => "-" + fmtD(c) + " \\times (" + fmtD(y) + " - " + R + ")", t0: 0, y0, k: pick([1, 2]) };
    }
    const F = kind === "tpy"
      ? { tex: "y' = t + y", f: (t, y) => t + y, show: (t, y) => fmtD(t) + " + " + par(y) }
      : { tex: "y' = t - y", f: (t, y) => t - y, show: (t, y) => fmtD(t) + " - " + par(y) };
    return Object.assign({ tdep: true, t0: pick([0, 1]), y0: randInt(1, 3), k: pick([0.1, 0.2, 0.5]) }, F);
  }

  /* ---------------- generators ---------------- */
  function genHeun() {
    const q = family(), f0 = q.f(q.t0, q.y0), pred = q.y0 + q.k * f0, t1 = r6(q.t0 + q.k), f1 = q.f(t1, pred);
    const ans = r6(q.y0 + q.k / 2 * (f0 + f1));
    const noPred = r6(q.y0 + q.k / 2 * (f0 + q.f(t1, q.y0)));
    return {
      prompt: "<p>Take one step of Heun's method with $k = " + q.k + "$ for</p><div class=\"display\">$$" + q.tex + ", \\qquad y(" + q.t0 + ") = " + q.y0 + ".$$</div><p>What is $y_1$?</p>",
      kind: "numbers", labels: ["$y_1 =$"], answer: [ans], tol: TOL,
      hint: "Three stages: the slope at the start; an Euler prediction of the end value; the slope at that predicted point. Then step with the average of the two slopes.",
      review: { href: "#lesson1", label: "Lesson 1, Heun's method" },
      diagnose: v => {
        const x = v[0];
        if (near(x, r6(pred), TOL)) return "That is the Euler prediction. Heun goes on to measure the slope at that predicted point and averages the two slopes.";
        if (!near(noPred, ans, TOL) && near(x, noPred, TOL)) return "The second slope should be measured at the predicted point, $y_0 + k f_0$, not at $y_0$.";
        if (near(x, r6(q.y0 + q.k * (f0 + f1)), TOL)) return "Use the average of the two slopes: multiply their sum by $k/2$, not by $k$.";
        if (near(x, r6(q.k / 2 * (f0 + f1)), TOL)) return "That is the change over the step. Add it to $y_0$.";
        return null;
      },
      explain: "<p>Slope at the start: $f_0 = f(" + q.t0 + ", " + q.y0 + ") = " + q.show(q.t0, q.y0) + " = " + fmtD(f0) + "$. Euler prediction: $" + q.y0 + " + " + q.k + " \\times " + par(f0) + " = " + fmtD(pred) + "$. " +
        "Slope there: $f(" + fmtD(t1) + ", " + fmtD(pred) + ") = " + q.show(t1, pred) + " = " + fmtD(f1) + "$. So</p><div class=\"display\">$$y_1 = " + q.y0 + " + \\frac{" + q.k + "}{2}\\big(" + fmtD(f0) + " + " + par(f1) + "\\big) = " + fmtD(ans) + ".$$</div>",
    };
  }

  function genRK4k() {
    const q = family(), f0 = q.f(q.t0, q.y0), k1 = r6(q.k * f0), tm = r6(q.t0 + q.k / 2), ym = r6(q.y0 + k1 / 2), k2 = r6(q.k * q.f(tm, ym));
    const k2full = r6(q.k * q.f(tm, q.y0 + k1)), k2end = r6(q.k * q.f(r6(q.t0 + q.k), ym));
    return {
      prompt: "<p>Start one step of the classic RK4 method with $k = " + q.k + "$ for</p><div class=\"display\">$$" + q.tex + ", \\qquad y(" + q.t0 + ") = " + q.y0 + ".$$</div><p>Find $k_1$ and $k_2$.</p>",
      kind: "numbers", labels: ["$k_1 =$", "$k_2 =$"], answer: [k1, k2], tol: TOL,
      hint: "$k_1 = k\\, f(t_0, y_0)$ and $k_2 = k\\, f\\big(t_0 + \\tfrac{k}{2},\\; y_0 + \\tfrac12 k_1\\big)$. Each is the step times a slope.",
      review: { href: "#lesson2", label: "Lesson 2, the four changes" },
      diagnose: v => {
        if (near(v[0], f0, TOL) && !near(f0, k1, TOL)) return "$k_1$ is the step times the slope, $k\\, f(t_0, y_0)$, not the slope itself.";
        if (!near(v[0], k1, TOL)) return "Check $k_1$ first: the step times the slope at the starting point.";
        if (near(v[1], k2full, TOL) && !near(k2full, k2, TOL)) return "$k_1$ is right. For $k_2$, go only half a step: use $y_0 + \\tfrac12 k_1$.";
        if (q.tdep && near(v[1], k2end, TOL) && !near(k2end, k2, TOL)) return "$k_1$ is right. $k_2$ is measured at the midpoint time, $t_0 + \\tfrac{k}{2}$.";
        if (near(v[1], r6(q.f(tm, ym)), TOL) && !near(q.f(tm, ym), k2, TOL)) return "$k_1$ is right. Remember to multiply the midpoint slope by the step $k$.";
        return "$k_1$ is right. Recheck $k_2$: the step times the slope at $\\big(t_0 + \\tfrac{k}{2},\\; y_0 + \\tfrac12 k_1\\big)$.";
      },
      explain: "<p>$k_1 = " + q.k + " \\times f(" + q.t0 + ", " + q.y0 + ") = " + q.k + " \\times " + par(f0) + " = " + fmtD(k1) + "$.</p>" +
        "<p>The midpoint is $t = " + fmtD(tm) + "$, $y = " + q.y0 + " + \\tfrac12 \\times " + par(k1) + " = " + fmtD(ym) + "$, so $k_2 = " + q.k + " \\times f(" + fmtD(tm) + ", " + fmtD(ym) + ") = " + q.k + " \\times " + par(r6(q.f(tm, ym))) + " = " + fmtD(k2) + "$.</p>",
    };
  }

  function genSimpson() {
    const forms = [
      { tex: "3t^2", g: t => 3 * t * t }, { tex: "4t^3", g: t => 4 * t * t * t }, { tex: "2t + 1", g: t => 2 * t + 1 }, { tex: "6t^2 - 2t", g: t => 6 * t * t - 2 * t },
    ];
    const F = pick(forms), k = pick([1, 2]), y0 = randInt(0, 3);
    const gm = F.g(k / 2), ans = r6(y0 + k / 6 * (F.g(0) + 4 * gm + F.g(k)));
    const euler = y0 + k * F.g(0);
    return {
      prompt: "<p>Take one step of the classic RK4 method with $k = " + k + "$ for $y' = " + F.tex + "$, $y(0) = " + y0 + "$. Here $f$ depends only on $t$, so $k_2 = k_3$. What is $y_1$?</p>",
      kind: "numbers", labels: ["$y_1 =$"], answer: [ans], tol: TOL,
      hint: "Compute $k_1 = k f(0)$, $k_2 = k_3 = k f(k/2)$ and $k_4 = k f(k)$, then $y_1 = y_0 + \\tfrac16(k_1 + 2k_2 + 2k_3 + k_4)$.",
      review: { href: "#lesson2", label: "Lesson 2, Four slopes: RK4" },
      diagnose: v => {
        if (near(v[0], euler, TOL)) return "That is Euler's step. RK4 also uses the slopes at the midpoint and the end.";
        if (near(v[0], r6(y0 + k / 4 * (F.g(0) + 2 * gm + F.g(k))), TOL)) return "Check the weights: they are $1, 2, 2, 1$, divided by 6.";
        return null;
      },
      explain: "<p>$k_1 = " + k + " \\times " + fmtD(F.g(0)) + " = " + fmtD(k * F.g(0)) + "$, $k_2 = k_3 = " + k + " \\times " + fmtD(gm) + " = " + fmtD(k * gm) + "$, $k_4 = " + k + " \\times " + fmtD(F.g(k)) + " = " + fmtD(k * F.g(k)) + "$, so</p>" +
        "<div class=\"display\">$$y_1 = " + y0 + " + \\tfrac16\\big(" + fmtD(k * F.g(0)) + " + 4 \\times " + fmtD(k * gm) + " + " + fmtD(k * F.g(k)) + "\\big) = " + fmtD(ans) + ".$$</div>" +
        "<p>This is exactly Simpson's rule for $\\int_0^{" + k + "} " + F.tex + "\\,dt$, which is exact for polynomials up to degree 3, so $y_1$ here is the true value $y(" + k + ")$.</p>",
    };
  }

  function genOrder() {
    let m, k1, f, k2, E, ans;
    do {
      m = pick(METHODS); k1 = pick([0.1, 0.2, 0.4]); f = pick([2, 10]); k2 = r6(k1 / f);
      E = pick([0.008, 0.016, 0.05, 0.3, 0.64]); ans = E / Math.pow(f, m.order);
    } while (ans < 1e-5);
    const rel = Math.abs(ans) * 0.02;
    return {
      prompt: "<p>" + cap(m.label) + " (order " + m.order + ") gives an error of $" + E + "$ at $t = 1$ with step $k = " + k1 + "$. Estimate the error at $t = 1$ with step $k = " + k2 + "$.</p>",
      kind: "numbers", labels: ["error ≈"], answer: [ans], tol: rel,
      hint: "For a method of order $p$, dividing the step by a factor divides the error by that factor to the power $p$.",
      review: { href: "#lesson3", label: "Lesson 3, the table of orders" },
      diagnose: v => {
        const x = v[0];
        for (const p of [1, 2, 4]) if (p !== m.order && near(x, E / Math.pow(f, p), Math.abs(E / Math.pow(f, p)) * 0.02)) return "That would be right for a method of order " + p + ". This one has order " + m.order + ".";
        return null;
      },
      explain: "<p>The step is divided by " + f + ", so the error is divided by about $" + f + "^" + m.order + " = " + Math.pow(f, m.order) + "$: $" + E + " / " + Math.pow(f, m.order) + " = " + String(Number(ans.toPrecision(4))) + "$.</p>",
    };
  }

  function genWork() {
    if (Math.random() < 0.5) {
      const m = pick(METHODS), T = pick([1, 2, 5]), k = pick([0.1, 0.05, 0.01]), M = Math.round(T / k);
      return {
        prompt: "<p>" + cap(m.label) + " is run from $t = 0$ to $t = " + T + "$ with step $k = " + k + "$. How many evaluations of $f$ does it make?</p>",
        kind: "numbers", labels: ["evaluations ="], answer: [M * m.cost], tol: 0.5,
        hint: "Find the number of steps $M$, then multiply by the number of evaluations of $f$ each step of this method uses.",
        review: { href: "#lesson3", label: "Lesson 3, the table of orders and costs" },
        diagnose: v => (near(v[0], M, 0.5) ? "That is the number of steps. How many evaluations of $f$ does each " + m.name + " step use?" : null),
        explain: "<p>$M = " + T + " / " + k + " = " + M + "$ steps, each using " + m.cost + (m.cost === 1 ? " evaluation" : " evaluations") + " of $f$: $" + M + " \\times " + m.cost + " = " + M * m.cost + "$.</p>",
      };
    }
    const N = pick([200, 400, 800, 1200]), m = pick(METHODS.slice(1));
    return {
      prompt: "<p>You can afford " + N + " evaluations of $f$. How many steps of " + m.label + " is that?</p>",
      kind: "numbers", labels: ["steps ="], answer: [N / m.cost], tol: 0.5,
      hint: "How many evaluations of $f$ does each " + m.name + " step use?",
      review: { href: "#lesson3", label: "Lesson 3, Accuracy against work" },
      diagnose: v => (near(v[0], N, 0.5) ? "That would be right for Euler, which uses one evaluation per step." : null),
      explain: "<p>Each " + m.name + " step uses " + m.cost + " evaluations, so " + N + " evaluations buy $" + N + " / " + m.cost + " = " + N / m.cost + "$ steps.</p>",
    };
  }

  const CONCEPTS = [
    () => ({
      prompt: "<p>Why is the trapezoidal method $y_{j+1} = y_j + \\frac{k}{2}(f_j + f_{j+1})$ implicit?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "The end slope $f_{j+1} = f(t_{j+1}, y_{j+1})$ needs $y_{j+1}$, the value being computed", why: null },
        { html: "It uses two slopes", why: "Heun's method also uses two slopes and is explicit. What does each slope need to be computed?" },
        { html: "It is second order", why: "Order is about accuracy, not about how $y_{j+1}$ is found." },
        { html: "It comes from an integration rule", why: "Euler's method and Heun's method come from integration rules too, and both are explicit." },
      ],
      review: { href: "#lesson1", label: "Lesson 1, The trapezoid rule, and its catch" },
      explain: "<p>The formula contains $f(t_{j+1}, y_{j+1})$, so $y_{j+1}$ appears on both sides and each step means solving an equation. Heun avoids this by evaluating the end slope at an Euler prediction instead.</p>",
    }),
    () => ({
      prompt: "<p>In the classic RK4 method, what is $k_2$?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "The step times the slope at a midpoint, reached using half of $k_1$", why: null },
        { html: "A second, smaller step size", why: "In RK4 the step size is $k$ throughout. Look at the formula: what is $k$ multiplied by?" },
        { html: "The slope at the end of the step", why: "The end of the step appears in $k_4$, and each $k_i$ includes the factor $k$." },
        { html: "Half of $k_1$", why: "Half of $k_1$ is used to reach the midpoint, but $k_2$ comes from a new slope measured there." },
      ],
      review: { href: "#lesson2", label: "Lesson 2, Careful with the notation" },
      explain: "<p>$k_2 = k\\, f\\big(t_j + \\tfrac{k}{2},\\; y_j + \\tfrac12 k_1\\big)$: go half a step using $k_1$, measure the slope there, and multiply by the step. Like every $k_i$, it is a change in $y$.</p>",
    }),
    () => ({
      prompt: "<p>For a smooth, non-stiff problem you can afford 400 evaluations of $f$. Which choice is likely to be more accurate?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "RK4 with 100 steps", why: null },
        { html: "Euler with 400 steps", why: "More steps, but each with a first-order method. Compare how fast the two errors shrink with the step." },
        { html: "They are about equally accurate, since the work is the same", why: "Equal work does not mean equal accuracy. Look at the equal-work table in Lesson 3." },
        { html: "It is impossible to say without running both", why: "For smooth problems the orders tell you: compare the equal-work table in Lesson 3." },
      ],
      review: { href: "#lesson3", label: "Lesson 3, Accuracy against work" },
      explain: "<p>With the same work, the fourth-order method wins by a wide margin: in the logistic example, RK4 with 40 steps was about a thousand times more accurate than Euler with 160.</p>",
    }),
    () => ({
      prompt: "<p>A problem is stiff, and Euler's method needs $k < 2/r$ with a large $r$. What happens if you switch to RK4?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "The step limit barely changes: RK4 needs $k < 2.785/r$", why: null },
        { html: "The step limit disappears, because RK4 is fourth order", why: "Order is about accuracy, not stability. Is RK4 explicit or implicit?" },
        { html: "The step limit gets smaller, because RK4 uses more slopes", why: "Compare the two limits: $2/r$ and $2.785/r$." },
        { html: "RK4 becomes A-stable once the step is small", why: "A-stable means stable for every step. RK4 is only conditionally A-stable." },
      ],
      review: { href: "#lesson3", label: "Lesson 3, What RK4 does not fix" },
      explain: "<p>Every explicit Runge–Kutta method is only conditionally A-stable. RK4's limit, $k < 2.785/r$, is only a little larger than Euler's, so stiff problems still call for implicit methods.</p>",
    }),
  ];

  /* ---------------- quick checks ---------------- */
  const QC1 = {
    prompt: "<p>Take one Heun step for the coffee, $y' = -0.1\\,(y - 20)$, $y(0) = 90$, with step $k = 2$. What is $y_1$?</p>",
    kind: "numbers", labels: ["$y_1 =$"], answer: [77.4], tol: TOL,
    hint: "Slope at the start, $f(0, 90)$; Euler prediction at $t = 2$; slope at the predicted point; then step with the average slope.",
    diagnose: v => {
      if (near(v[0], 76, TOL)) return "That is the Euler prediction. Now measure the slope at the predicted point and average the two slopes.";
      if (near(v[0], 64.8, TOL)) return "Multiply the sum of the two slopes by $k/2$, not by $k$.";
      return null;
    },
    explain: "<p>$f(0, 90) = -7$. Euler predicts $90 + 2 \\times (-7) = 76$. Slope there: $f(2, 76) = -0.1 \\times 56 = -5.6$. So $y_1 = 90 + \\tfrac{2}{2}\\big(-7 + (-5.6)\\big) = 77.4$. The true value is $77.31$; Euler's $76$ was off by $1.3$.</p>",
  };
  const QC2 = {
    prompt: "<p>Start one RK4 step for the coffee, $y' = -0.1\\,(y - 20)$, $y(0) = 90$, with step $k = 2$. Find $k_1$ and $k_2$.</p>",
    kind: "numbers", labels: ["$k_1 =$", "$k_2 =$"], answer: [-14, -12.6], tol: TOL,
    hint: "$k_1 = k\\, f(0, 90)$. For $k_2$, go half a step: the slope at $t = 1$, $y = 90 + \\tfrac12 k_1$, times $k$.",
    diagnose: v => {
      if (near(v[0], -7, TOL)) return "$-7$ is the slope. $k_1$ is the step times the slope.";
      if (!near(v[0], -14, TOL)) return "Check $k_1$ first: the step times the slope at the starting point.";
      if (near(v[1], -11.2, TOL)) return "$k_1$ is right. For $k_2$, go only half a step: use $90 + \\tfrac12 k_1$.";
      if (near(v[1], -6.3, TOL)) return "$k_1$ is right. Multiply the midpoint slope by the step $k = 2$.";
      return null;
    },
    explain: "<p>$k_1 = 2 \\times f(0, 90) = 2 \\times (-7) = -14$. The midpoint is $y = 90 + \\tfrac12(-14) = 83$ at $t = 1$, so $k_2 = 2 \\times f(1, 83) = 2 \\times (-6.3) = -12.6$.</p>",
  };
  const QC3 = {
    prompt: "<p>RK4 gives an error of $0.0032$ with step $k = 0.2$. Estimate the error with $k = 0.1$.</p>",
    kind: "numbers", labels: ["error ≈"], answer: [0.0002], tol: 0.000005,
    hint: "RK4 is fourth order. Halving the step divides the error by what?",
    diagnose: v => {
      if (near(v[0], 0.0016, 0.00003)) return "That would be right for a first-order method like Euler.";
      if (near(v[0], 0.0008, 0.00002)) return "That would be right for a second-order method like Heun.";
      return null;
    },
    explain: "<p>Fourth order: halving the step divides the error by $2^4 = 16$, so $0.0032 / 16 = 0.0002$.</p>",
  };

  document.addEventListener("DOMContentLoaded", () => {
    figHeun();
    explorer(document.getElementById("ex-compare"));
    L.quick(document.getElementById("qc1"), QC1);
    L.quick(document.getElementById("qc2"), QC2);
    L.quick(document.getElementById("qc3"), QC3);
    L.practice(document.getElementById("practice"), [genHeun, genHeun, genRK4k, genSimpson, genOrder, genWork, () => pick(CONCEPTS)()]);
    L.moduleCheck(document.getElementById("check"), "m04", () => [genHeun(), pick([genRK4k, genSimpson])(), genOrder(), genWork(), pick(CONCEPTS)()]);
    L.renderMath(document.getElementById("main"));
  });
})();
