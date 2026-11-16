/* Module 5 — ODE solvers in practice: SIR explorer, adaptive-step figure, quick checks, practice and module check. */
(function () {
  "use strict";
  const L = window.LAR, P = window.ODEPlot;
  const { randInt, pick, shuffle } = L;

  const r6 = x => Math.round(x * 1e6) / 1e6;
  const r8 = x => Math.round(x * 1e8) / 1e8;
  function fmtD(x) { x = r8(x); return Object.is(x, -0) ? "0" : String(x); }
  const par = x => (r8(x) < 0 ? "(" + fmtD(x) + ")" : fmtD(x));
  const pct = x => (x > 0 && x < 0.005 ? "under 1%" : Math.round(100 * x) + "%");
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const TOL = 0.000011;

  /* ---------------- SIR with RK4 ---------------- */
  function sir(a, b, T, k) {
    const f = y => [-a * y[0] * y[1], -b * y[1] + a * y[0] * y[1], b * y[1]];
    const add = (y, d, h) => y.map((v, i) => v + h * d[i]);
    let y = [0.99, 0.01, 0], t = 0;
    const pts = [[0, y.slice()]];
    const n = Math.round(T / k);
    for (let j = 0; j < n; j++) {
      const k1 = f(y), k2 = f(add(y, k1, k / 2)), k3 = f(add(y, k2, k / 2)), k4 = f(add(y, k3, k));
      y = y.map((v, i) => v + k / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      t = (j + 1) * k;
      pts.push([t, y.slice()]);
    }
    return pts;
  }

  function explorer(root) {
    root.innerHTML =
      '<p style="margin-top:0">The SIR model, starting with 1% of the population ill, solved with RK4 for 160 days.</p>' +
      '<div class="slider-row"><label for="ex-a">Infection rate $a$</label><input type="range" id="ex-a" min="0.1" max="0.6" step="0.02" value="0.3"><output for="ex-a"></output></div>' +
      '<div class="slider-row"><label for="ex-b">Recovery rate $b$</label><input type="range" id="ex-b" min="0.05" max="0.3" step="0.01" value="0.1"><output for="ex-b"></output></div>' +
      '<svg class="plot" role="img"></svg>' +
      '<p class="legend small"><span class="swatch sw-s" aria-hidden="true"></span>$S$, susceptible <span class="swatch sw-i" aria-hidden="true"></span>$I$, ill <span class="swatch sw-r" aria-hidden="true"></span>$R$, recovered</p>' +
      '<p class="readout" aria-live="polite"></p>';
    L.renderMath(root);
    const sa = root.querySelector("#ex-a"), sb = root.querySelector("#ex-b"), outs = root.querySelectorAll("output");
    const svg = root.querySelector("svg"), readout = root.querySelector(".readout");
    let timer = null;
    function update() {
      const a = Number(sa.value), b = Number(sb.value);
      outs[0].textContent = a.toFixed(2); outs[1].textContent = b.toFixed(2);
      const pts = sir(a, b, 160, 0.25);
      let peak = pts[0];
      pts.forEach(p => { if (p[1][1] > peak[1][1]) peak = p; });
      const last = pts[pts.length - 1][1];
      const p = P.make(svg, { margin: { r: 26 }, x: [0, 160], y: [0, 1], xticks: [0, 40, 80, 120, 160], yticks: [0, 0.25, 0.5, 0.75, 1], xlabel: "time t (days)", ylabel: "fraction of population" });
      [["sir-s", 0, "S"], ["sir-r", 2, "R"], ["sir-i", 1, "I"]].forEach(([cls, i, name]) => {
        p.path(pts.filter((_, j) => j % 2 === 0).map(q => [q[0], q[1][i]]), cls);
        p.label(160, last[i], name, cls + "-text", 6, 4);
      });
      const grows = a > b * 0.99;
      if (peak[0] > 0 && peak[0] < 160 - 1e-9) { p.dot(peak[0], peak[1][1], "peak-pt", 5); }
      const ratio = Math.round(a / b * 100) / 100;
      const stillRising = peak[0] >= 160 - 1e-9;
      readout.textContent = (peak[0] === 0
        ? "The ill fraction shrinks from the start: no outbreak. "
        : stillRising ? "The outbreak grows so slowly that the ill fraction is still rising on day 160 (" + pct(peak[1][1]) + " ill). "
        : "Peak: " + pct(peak[1][1]) + " of the population ill, on day " + Math.round(peak[0]) + ". ") +
        "By day 160, " + pct(last[0]) + " have never been infected. Each ill person infects about a/b = " + ratio + (ratio === 1 ? " other person" : " others") + " in a fully susceptible population.";
      svg.setAttribute("aria-label", "Fractions susceptible, ill and recovered over 160 days, with a = " + a.toFixed(2) + " and b = " + b.toFixed(2) + ". " +
        (peak[0] > 0 ? "S falls from 0.99 to " + last[0].toFixed(2) + "; I rises to " + (peak[0] < 160 - 1e-9 ? "a peak of " + peak[1][1].toFixed(2) + " on day " + Math.round(peak[0]) + " and then falls" : peak[1][1].toFixed(2) + " and is still rising at day 160") + "; R rises to " + last[2].toFixed(2) + "."
          : "I falls steadily from 0.01; S stays near " + last[0].toFixed(2) + "."));
    }
    [sa, sb].forEach(s => s.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 40); }));
    update();
  }

  /* ---------------- adaptive RK4 on the logistic equation ---------------- */
  function figAdaptive() {
    const svg = document.getElementById("fig-adaptive");
    if (!svg) return;
    const f = (t, y) => 10 * y * (1 - y), ex = t => 0.01 / (0.01 + 0.99 * Math.exp(-10 * t));
    const rk4 = (t, y, h) => { const k1 = h * f(t, y), k2 = h * f(t + h / 2, y + k1 / 2), k3 = h * f(t + h / 2, y + k2 / 2), k4 = h * f(t + h, y + k3); return y + (k1 + 2 * k2 + 2 * k3 + k4) / 6; };
    const tol = 1e-6;
    let t = 0, y = 0.01, h = 0.1;
    const pts = [[0, y]];
    while (t < 2 - 1e-12) {
      h = Math.min(h, 2 - t);
      const big = rk4(t, y, h), half = rk4(t + h / 2, rk4(t, y, h / 2), h / 2);
      const err = Math.abs(half - big) / 15;
      if (err <= tol) { t += h; y = half; pts.push([t, y]); }
      h *= Math.min(2, Math.max(0.2, 0.9 * Math.pow(tol / Math.max(err, 1e-16), 0.2)));
    }
    const p = P.make(svg, { x: [0, 2], y: [-0.08, 1.1], xticks: [0, 0.5, 1, 1.5, 2], yticks: [0, 0.5, 1], xlabel: "time t", ylabel: "y" });
    p.curve(ex, 0, 2, 300, "exact");
    pts.forEach(q => { p.dot(q[0], q[1], "euler-pt", 3.6); p.seg(q[0], -0.08, q[0], -0.03, "steptick"); });
    const cap = document.getElementById("adaptive-count");
    if (cap) cap.textContent = String(pts.length - 1);
  }

  /* ---------------- generators ---------------- */
  function genSIRStep() {
    const a = pick([0.2, 0.3, 0.4, 0.5]), b = pick([0.1, 0.2]), I0 = pick([0.01, 0.02, 0.05, 0.1]), R0 = pick([0, 0, 0.05, 0.1]);
    const S0 = r6(1 - I0 - R0), k = pick([1, 0.5, 2]);
    const inf = r8(a * S0 * I0), rec = r8(b * I0);
    const S1 = r8(S0 - k * inf), I1 = r8(I0 + k * (inf - rec)), R1 = r8(R0 + k * rec);
    const infNew = a * S1 * I0;
    return {
      prompt: "<p>Take one Euler step with $k = " + k + "$ day for the SIR model with $a = " + a + "$ and $b = " + b + "$, starting from $S = " + S0 + "$, $I = " + I0 + "$, $R = " + R0 + "$. Give the new values to at least 5 decimal places.</p>",
      kind: "numbers", labels: ["$S_1 =$", "$I_1 =$", "$R_1 =$"], answer: [S1, I1, R1], tol: TOL,
      hint: "First work out the three slopes, $-aSI$, $-bI + aSI$ and $bI$, all from the starting values. Then add $k$ times each slope to its component.",
      review: { href: "#lesson1", label: "Lesson 1, A worked Euler step" },
      diagnose: v => {
        const sum = v[0] + v[1] + v[2];
        if (k !== 1 && near(v[0], S0 - inf, TOL)) return "Remember to multiply each slope by the step $k = " + k + "$.";
        if (near(v[1], r8(I0 + k * (infNew - rec)), TOL) && !near(infNew, inf, 1e-7)) return "For $I$, compute $aSI$ with the <em>old</em> value of $S$, not the updated one. All three slopes come from the starting values.";
        if (!near(sum, 1, 2 * TOL)) return "Check: your three values should still add up to 1, because $S' + I' + R' = 0$.";
        return null;
      },
      explain: "<p>New infections: $aSI = " + a + " \\times " + S0 + " \\times " + I0 + " = " + fmtD(inf) + "$. Recoveries: $bI = " + b + " \\times " + I0 + " = " + fmtD(rec) + "$.</p>" +
        "<p>$S_1 = " + S0 + " - " + k + " \\times " + fmtD(inf) + " = " + fmtD(S1) + "$, $\\; I_1 = " + I0 + " + " + k + " \\times (" + fmtD(inf) + " - " + fmtD(rec) + ") = " + fmtD(I1) + "$, $\\; R_1 = " + R0 + " + " + k + " \\times " + fmtD(rec) + " = " + fmtD(R1) + "$. They still add up to 1.</p>",
    };
  }

  function genLinStep() {
    const p = pick([1, -1, 2, -2]), q = pick([-3, -1, 1, 2]), c = pick([0, 5, 10]), r = pick([-1, 1, 2]), s = pick([-2, 1, 2]), d = pick([0, 3, 5]);
    const u0 = randInt(1, 3), v0 = randInt(0, 2), k = pick([0.1, 0.5]);
    const fu = p * u0 + q * v0 + c, fv = r * u0 + s * v0 + d * 0;
    const u1 = r6(u0 + k * fu), v1 = r6(v0 + k * fv);
    const lin = (co, name, first) => (co === 0 ? "" : (co < 0 ? " - " : first ? "" : " + ") + (Math.abs(co) === 1 ? "" : Math.abs(co)) + name);
    const ut = (lin(p, "u", true) + lin(q, "v", false) + (c ? " + " + c : "")).trim();
    const vt = (lin(r, "u", true) + lin(s, "v", false) + (d ? " + " + d + "t" : "")).trim();
    const vMixed = r6(v0 + k * (r * u1 + s * v0));
    return {
      prompt: "<p>Take one Euler step with $k = " + k + "$ for the system</p><div class=\"display\">$$\\begin{aligned} u' &= " + ut + ", \\\\ v' &= " + vt + ", \\\\ u(0) &= " + u0 + ", \\quad v(0) = " + v0 + ". \\end{aligned}$$</div><p>Give $u_1$ and $v_1$.</p>",
      kind: "numbers", labels: ["$u_1 =$", "$v_1 =$"], answer: [u1, v1], tol: TOL,
      hint: "Work out both slopes at $t = 0$ from the starting values $u_0, v_0$, then step each component.",
      review: { href: "#lesson1", label: "Lesson 1, Vectors make it one equation" },
      diagnose: v => {
        if (!near(v[0], u1, TOL)) return "Check $u_1$ first: $u_0 + k$ times the slope $u'$ evaluated at $t = 0$, $u = " + u0 + "$, $v = " + v0 + "$.";
        if (near(v[1], vMixed, TOL) && !near(vMixed, v1, TOL)) return "$u_1$ is right. For $v_1$, use the <em>old</em> value $u_0$ in the slope, not the new $u_1$.";
        return "$u_1$ is right. Recheck $v_1$: the slope $v'$ at $t = 0$ uses $u_0$ and $v_0$.";
      },
      explain: "<p>At $t = 0$: $u' = " + fmtD(fu) + "$ and $v' = " + fmtD(fv) + "$. So $u_1 = " + u0 + " + " + k + " \\times " + par(fu) + " = " + fmtD(u1) + "$ and $v_1 = " + v0 + " + " + k + " \\times " + par(fv) + " = " + fmtD(v1) + "$.</p>",
    };
  }

  function genThreshold() {
    const b = pick([0.1, 0.2, 0.25]), a = pick([0.3, 0.4, 0.5, 0.8]);
    const ans = r6(b / a);
    return {
      prompt: "<p>In the SIR model with $a = " + a + "$ and $b = " + b + "$, the ill fraction $I$ grows only while $S$ is above a certain value. What is that value? (It is also the value of $S$ at the peak of $I$.)</p>",
      kind: "numbers", labels: ["$S =$"], answer: [ans], tol: 0.001,
      hint: "Factor the equation for $I$: $I' = -bI + aSI = I\\,(aS - b)$. When is that positive?",
      review: { href: "#lesson1", label: "Lesson 1, Try this (question 3)" },
      diagnose: v => (near(v[0], a / b, 0.01) ? "That is $a/b$. Solve $aS - b = 0$ for $S$." : null),
      explain: "<p>$I' = I\\,(aS - b)$ is positive when $aS > b$, that is $S > b/a = " + b + " / " + a + " = " + fmtD(ans) + "$. At the peak $I' = 0$, so $S = b/a$ there.</p>",
    };
  }

  function genConserve() {
    const N = pick([10000, 50000, 2000]), S = Math.round(N * pick([0.4, 0.55, 0.62, 0.71]) / 10) * 10, I = Math.round(N * pick([0.05, 0.12, 0.2]) / 10) * 10;
    return {
      prompt: "<p>A town of " + N.toLocaleString("en-US") + " people is modeled with the SIR equations, using numbers of people instead of fractions. On day 40 a solver reports $S = " + S.toLocaleString("en-US").replace(/,/g, "{,}") + "$ and $I = " + I.toLocaleString("en-US").replace(/,/g, "{,}") + "$. If the solver is working properly, what should $R$ be?</p>",
      kind: "numbers", labels: ["$R =$"], answer: [N - S - I], tol: 0.5,
      hint: "Add up the three SIR equations. What happens to $S + I + R$ over time?",
      review: { href: "#lesson1", label: "Lesson 1, The SIR model" },
      diagnose: v => null,
      explain: "<p>$S' + I' + R' = 0$, so $S + I + R$ stays equal to the whole town: $R = " + N + " - " + S + " - " + I + " = " + (N - S - I) + "$. A solver whose three values do not add up has gone wrong.</p>",
    };
  }

  const SECOND = [
    { eq: "y'' = -4y", right: "v' = -4y", wrong: [["y' = -4y,\\; v' = v", "The new variable $v$ is the velocity, so the first equation should say $y' = v$."], ["y' = v,\\; v' = 4y", "Check the sign: $v' = y''$, and $y'' = -4y$."], ["y' = v,\\; v' = -4v", "$v' = y''$ equals $-4$ times the position $y$, not the velocity $v$."]] },
    { eq: "y'' + 0.5\\,y' + 9y = 0", right: "v' = -0.5\\,v - 9y", wrong: [["y' = v,\\; v' = -0.5\\,y - 9v", "Which term goes with the velocity? $y'$ is $v$."], ["y' = v,\\; v' = 0.5\\,v + 9y", "Solve the equation for $y''$ first: move the other terms to the right-hand side."], ["y' = v,\\; v' = -9y", "Don't drop the friction term $0.5\\,y'$: in the new variables it is $0.5\\,v$."]] },
    { eq: "\\theta'' = -\\sin\\theta", right: "\\omega' = -\\sin\\theta", vel: "\\omega", pos: "\\theta", wrong: [["\\theta' = -\\sin\\theta,\\; \\omega' = \\omega", "The new variable $\\omega$ is the angular velocity, so the first equation should say $\\theta' = \\omega$."], ["\\theta' = \\omega,\\; \\omega' = \\sin\\theta", "Check the sign: $\\omega' = \\theta''$."], ["\\theta' = \\omega,\\; \\omega' = -\\sin\\omega", "The sine is of the angle $\\theta$, not of the angular velocity."]] },
    { eq: "2y'' = -6y + \\cos t", right: "v' = -3y + \\tfrac12\\cos t", wrong: [["y' = v,\\; v' = -6y + \\cos t", "Divide by the mass first: $y'' = \\tfrac12(-6y + \\cos t)$."], ["y' = v,\\; v' = -3v + \\tfrac12\\cos t", "$-3$ multiplies the position $y$, not the velocity."], ["y' = -3y + \\tfrac12\\cos t,\\; v' = v", "The first equation should define the velocity: $y' = v$."]] },
  ];
  function genSecond() {
    const E = pick(SECOND), pos = E.pos || "y", vel = E.vel || "v";
    const right = pos + "' = " + vel + ",\\; " + E.right;
    return {
      prompt: "<p>Write $" + E.eq + "$ as a first-order system, using $" + vel + " = " + pos + "'$. Which is correct?</p>",
      kind: "mc", answer: 0,
      options: [{ html: "$" + right + "$", why: null }].concat(E.wrong.map(w => ({ html: "$" + w[0] + "$", why: w[1] }))),
      review: { href: "#lesson2", label: "Lesson 2, Second-order equations" },
      explain: "<p>The first equation defines the velocity, $" + pos + "' = " + vel + "$. The second is the original equation solved for the second derivative, with $" + pos + "'$ replaced by $" + vel + "$: $" + E.right + "$.</p>",
    };
  }

  const ADAPT = [
    () => ({
      prompt: "<p>Where does an adaptive solver take its smallest steps?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "Where the solution changes quickly", why: null },
        { html: "Where the solution is flat", why: "Where the solution is flat, a long step is already accurate. Look at the figure in Lesson 3." },
        { html: "Near the end of the time interval", why: "The end of the interval is not special. What matters is how fast the solution is changing." },
        { html: "It takes the same step everywhere", why: "That is a fixed-step method. What does “adaptive” change?" },
      ],
      review: { href: "#lesson3", label: "Lesson 3, They choose the step for you" },
      explain: "<p>The solver keeps its estimated error per step below the tolerance. Where the solution changes quickly, that needs short steps; where it is flat, long steps are enough.</p>",
    }),
    () => ({
      prompt: "<p>When you call a library ODE solver, what do you usually specify to control accuracy?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "A tolerance: how accurate you want the answer to be", why: null },
        { html: "The step size $k$", why: "Adaptive solvers choose the steps themselves. What do you tell them instead?" },
        { html: "The number of steps $M$", why: "Adaptive solvers decide how many steps to take." },
        { html: "The order of the method", why: "The default method's order is fixed. What do you tell the solver about accuracy?" },
      ],
      review: { href: "#lesson3", label: "Lesson 3, They choose the step for you" },
      explain: "<p>You set a tolerance, and the solver chooses its steps so that its estimated error per step stays below it.</p>",
    }),
  ];
  const OTHER = [
    () => ({
      prompt: "<p>A library's default (explicit, adaptive) solver takes millions of tiny steps on a problem whose solution looks smooth. What is the most likely explanation?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "The problem is stiff: use one of the library's stiff (implicit) methods", why: null },
        { html: "The tolerance is too loose", why: "A looser tolerance would mean fewer steps, not more." },
        { html: "The solution has no formula", why: "Most problems have no formula; solvers handle them easily when they are not stiff." },
        { html: "The method is not accurate enough for this problem", why: "The solution is smooth, so accuracy is not what forces the tiny steps. What else limits the step of an explicit method?" },
      ],
      review: { href: "#lesson3", label: "Lesson 3, They offer stiff methods" },
      explain: "<p>A smooth solution does not need tiny steps for accuracy. An explicit method's stability limit can force them anyway: that is stiffness (Module 3). An implicit stiff solver avoids it.</p>",
    }),
    () => ({
      prompt: "<p>You have solved a model and want to know whether to trust the answer. Which check is most useful?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "Solve again with a tighter tolerance and see whether the digits you care about change", why: null },
        { html: "Check that the solver finished without an error message", why: "A solver can finish happily with an inaccurate answer." },
        { html: "Solve again with the same settings", why: "The same settings give the same answer, so this tells you nothing." },
        { html: "Plot the solution and check that it looks smooth", why: "A smooth curve can still be wrong, as the stable but inaccurate examples in Module 3 showed." },
      ],
      review: { href: "#lesson3", label: "Lesson 3, Before you trust the answer" },
      explain: "<p>If tightening the tolerance (or halving the step) changes the answer in the digits you care about, the first answer was not accurate enough. This is the same idea as comparing $k$ and $k/2$ in Module 2.</p>",
    }),
    () => ({
      prompt: "<p>When Euler's method is applied to a system, how is $\\mathbf{f}(t_j, \\mathbf{y}_j)$ computed?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "All components from the old values $\\mathbf{y}_j$, then all components updated together", why: null },
        { html: "Each component updated as soon as it is computed, and used right away in the next", why: "That mixes old and new values. Look at the worked SIR step: which values go into each slope?" },
        { html: "Only the first component; the others follow from it", why: "Every component has its own equation and its own slope." },
        { html: "It cannot be done: Euler's method only works for single equations", why: "Every method carries over to systems, with vectors in place of numbers." },
      ],
      review: { href: "#lesson1", label: "Lesson 1, Vectors make it one equation" },
      explain: "<p>$\\mathbf{y}_{j+1} = \\mathbf{y}_j + k\\,\\mathbf{f}(t_j, \\mathbf{y}_j)$: every slope is evaluated at the old point $\\mathbf{y}_j$, and then all components move together.</p>",
    }),
  ];

  /* ---------------- quick checks ---------------- */
  const QC1 = {
    prompt: "<p>Redo the worked SIR step ($a = 0.3$, $b = 0.1$, starting from $S = 0.99$, $I = 0.01$, $R = 0$) with a step of $k = 2$ days. Give the new values to at least 5 decimal places.</p>",
    kind: "numbers", labels: ["$S_1 =$", "$I_1 =$", "$R_1 =$"], answer: [0.98406, 0.01394, 0.002], tol: TOL,
    hint: "The slopes are the same as in the worked step, since they come from the same starting values. Only the step changes.",
    diagnose: v => {
      if (near(v[0], 0.98703, TOL)) return "Those are the values for $k = 1$. Multiply each slope by $k = 2$.";
      if (!near(v[0] + v[1] + v[2], 1, 2 * TOL)) return "Check: your three values should still add up to 1.";
      return null;
    },
    explain: "<p>The slopes are $-0.00297$, $0.00197$ and $0.001$. Times 2: $S_1 = 0.99 - 0.00594 = 0.98406$, $I_1 = 0.01 + 0.00394 = 0.01394$, $R_1 = 0.002$.</p>",
  };
  const QC2 = {
    prompt: "<p>A mass on a spring obeys $y'' = -9y$. Which first-order system, with $v = y'$, is equivalent?</p>",
    kind: "mc", answer: 0,
    options: [
      { html: "$y' = v,\\; v' = -9y$", why: null },
      { html: "$y' = -9y,\\; v' = v$", why: "The first equation should define the velocity: $y' = v$." },
      { html: "$y' = v,\\; v' = -9v$", why: "$y'' = -9y$ involves the position $y$, not the velocity." },
      { html: "$y' = v,\\; v' = 9y$", why: "Check the sign: $v' = y''$." },
    ],
    explain: "<p>$y' = v$ defines the velocity, and $v' = y'' = -9y$.</p>",
  };

  document.addEventListener("DOMContentLoaded", () => {
    explorer(document.getElementById("ex-sir"));
    figAdaptive();
    L.quick(document.getElementById("qc1"), QC1);
    L.quick(document.getElementById("qc2"), QC2);
    L.quick(document.getElementById("qc3"), ADAPT[0]());
    L.practice(document.getElementById("practice"), [genSIRStep, genLinStep, genThreshold, genConserve, genSecond, () => pick(ADAPT)(), () => pick(OTHER)()]);
    L.moduleCheck(document.getElementById("check"), "m05", () => [pick([genSIRStep, genLinStep])(), genSecond(), pick([genThreshold, genConserve])(), pick(ADAPT)(), pick(OTHER)()]);
    L.renderMath(document.getElementById("main"));
  });
})();
