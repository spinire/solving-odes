/* Module 1 — What an ODE solver does: slope-field explorer, quick checks, practice and module check. */
(function () {
  "use strict";
  const L = window.LAR, P = window.ODEPlot;
  const { randInt, pick, shuffle } = L;
  const NS = "http://www.w3.org/2000/svg";

  /* ---------------- number formatting ---------------- */
  const r6 = x => Math.round(x * 1e6) / 1e6;
  function fmtD(x) { x = r6(x); return Object.is(x, -0) ? "0" : String(x); }
  const par = x => (r6(x) < 0 ? "(" + fmtD(x) + ")" : fmtD(x));
  const plain = (x, d) => String(Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).replace("-", "−");
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const TOL = 0.0011;

  /* RK4 integration of y' = f(t, y) from (t0, y0) to t1, for drawing accurate solution curves */
  function trace(f, t0, y0, t1, n, ylo, yhi) {
    const h = (t1 - t0) / n, pts = [[t0, y0]];
    let t = t0, y = y0;
    for (let i = 0; i < n; i++) {
      const k1 = f(t, y), k2 = f(t + h / 2, y + h / 2 * k1), k3 = f(t + h / 2, y + h / 2 * k2), k4 = f(t + h, y + h * k3);
      y += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); t += h;
      if (!isFinite(y) || y < ylo || y > yhi) break;
      pts.push([t, y]);
    }
    return pts;
  }

  /* ---------------- explorer ---------------- */
  const EQS = {
    drug: {
      label: "Drug in the blood", tex: "y' = -0.13\\,y", v: "y", f: (t, y) => -0.13 * y,
      x: [0, 24], y: [0, 500], xt: [0, 4, 8, 12, 16, 20, 24], yt: [0, 100, 200, 300, 400, 500],
      xl: "time t (hours)", yl: "amount y (mg)", s: { min: 0, max: 500, step: 10, val: 400 }, grid: [16, 10],
      look: "The segments slope downward everywhere above zero, more steeply higher up, and are flat along y = 0.",
    },
    fish: {
      label: "Fish in a pond", tex: "y' = 0.5\\,y\\,(1 - y/100)", v: "y", f: (t, y) => 0.5 * y * (1 - y / 100),
      x: [0, 20], y: [0, 150], xt: [0, 4, 8, 12, 16, 20], yt: [0, 50, 100, 150],
      xl: "time t (years)", yl: "fish y", s: { min: 0, max: 150, step: 5, val: 10 }, grid: [20, 15],
      look: "The segments are flat along y = 0 and y = 100, rise between them most steeply near y = 50, and fall above 100.",
    },
    sky: {
      label: "Skydiver", tex: "v' = 9.8 - 0.2\\,v", v: "v", f: (t, v) => 9.8 - 0.2 * v,
      x: [0, 30], y: [0, 80], xt: [0, 5, 10, 15, 20, 25, 30], yt: [0, 20, 40, 60, 80],
      xl: "time t (seconds)", yl: "speed v (m/s)", s: { min: 0, max: 80, step: 1, val: 0 }, grid: [20, 16],
      look: "The segments are nearly flat around v = 49, rise below it and fall above it.",
    },
  };

  function explorer(root) {
    root.innerHTML =
      '<fieldset class="kpick"><legend>Equation</legend>' +
      Object.entries(EQS).map(([key, e], i) => '<label><input type="radio" name="ex-eq" value="' + key + '"' + (i === 0 ? " checked" : "") + "> " + e.label + "</label>").join("") +
      "</fieldset>" +
      '<p class="eq-shown display" style="margin:0.4rem 0"></p>' +
      '<div class="slider-row"><label for="ex-y0">Starting value</label><input type="range" id="ex-y0"><output for="ex-y0"></output></div>' +
      '<div class="buttons"><button type="button" data-act="draw">Draw this solution</button><button type="button" class="secondary" data-act="clear">Clear curves</button></div>' +
      '<svg class="plot clickable" role="img"></svg>' +
      '<p class="legend small"><span class="swatch sw-field" aria-hidden="true"></span>slope field <span class="swatch sw-euler" style="margin-left:0.8rem" aria-hidden="true"></span>solutions you drew</p>' +
      '<p class="small muted" style="margin:0.3rem 0 0">You can also click or tap the picture to start a solution at that point.</p>' +
      '<p class="readout" aria-live="polite"></p>';
    const svg = root.querySelector("svg"), readout = root.querySelector(".readout"), eqShown = root.querySelector(".eq-shown");
    const slider = root.querySelector("#ex-y0"), out = root.querySelector("output");
    let key = "drug", curves = [];

    function eq() { return EQS[key]; }
    function draw() {
      const e = eq();
      const p = P.make(svg, { x: e.x, y: e.y, xticks: e.xt, yticks: e.yt, xlabel: e.xl, ylabel: e.yl, nogrid: true });
      p.field(e.f, e.grid[0], e.grid[1], 13);
      curves.forEach((c, i) => {
        p.path(c.pts, "sol" + (i === curves.length - 1 ? " latest" : ""));
        p.dot(c.t0, c.y0, "euler-pt", 4.5);
      });
      svg.setAttribute("aria-label", "Slope field for " + e.label.toLowerCase() + ". " + e.look + " " +
        (curves.length ? curves.length + (curves.length === 1 ? " solution curve" : " solution curves") + " drawn, starting at " + curves.map(c => plain(c.y0, 1)).join(", ") + "." : "No solution curves drawn yet."));
      return p;
    }
    let plot = null;
    function addCurve(t0, y0) {
      const e = eq(), span = e.y[1] - e.y[0], lo = e.y[0] - span, hi = e.y[1] + span;
      const fwd = trace(e.f, t0, y0, e.x[1], 400, lo, hi);
      const back = t0 > e.x[0] ? trace(e.f, t0, y0, e.x[0], 400, lo, hi).reverse() : [];
      curves.push({ t0, y0, pts: back.concat(fwd.slice(back.length ? 1 : 0)) });
      if (curves.length > 8) curves.shift();
      plot = draw();
      const end = fwd[fwd.length - 1];
      const startTxt = t0 === 0 ? e.v + "(0) = " + plain(y0, 1) : "t = " + plain(t0, 1) + ", " + e.v + " = " + plain(y0, 1);
      readout.textContent = "Drew the solution starting at " + startTxt + ". At t = " + plain(end[0], 1) + " it is " + plain(end[1], 1) + ".";
    }
    function setEq(k) {
      key = k; curves = [];
      const e = eq();
      eqShown.innerHTML = "$$" + e.tex + "$$";
      L.renderMath(eqShown);
      slider.min = e.s.min; slider.max = e.s.max; slider.step = e.s.step; slider.value = e.s.val;
      root.querySelector('label[for="ex-y0"]').textContent = "Starting value " + e.v + "(0)";
      out.textContent = slider.value;
      readout.textContent = "Choose a starting value and press Draw, or click the picture.";
      plot = draw();
    }
    slider.addEventListener("input", () => { out.textContent = slider.value; });
    root.querySelector('[data-act="draw"]').addEventListener("click", () => addCurve(0, Number(slider.value)));
    root.querySelector('[data-act="clear"]').addEventListener("click", () => { curves = []; plot = draw(); readout.textContent = "Curves cleared."; });
    root.querySelectorAll('input[name="ex-eq"]').forEach(r => r.addEventListener("change", () => setEq(r.value)));
    svg.addEventListener("click", ev => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      const e = eq(), t = plot.Xinv(q.x), y = plot.Yinv(q.y);
      if (t < e.x[0] || t > e.x[1] || y < e.y[0] || y > e.y[1]) return;
      addCurve(t, y);
    });
    setEq("drug");
  }

  /* ---------------- slope-field thumbnails for questions ---------------- */
  const FIELDS = [
    { tex: "y' = y", f: (t, y) => y, look: "flat along the horizontal axis y = 0, rising above it and falling below it, the same all the way across", d: "the slopes would depend only on the height $y$: flat along $y = 0$, rising above it and falling below it." },
    { tex: "y' = -y", f: (t, y) => -y, look: "flat along the horizontal axis y = 0, falling above it and rising below it, the same all the way across", d: "the slopes would depend only on the height $y$: flat along $y = 0$, falling above it and rising below it." },
    { tex: "y' = t", f: (t, y) => t, look: "flat along the vertical axis t = 0, rising to its right and falling to its left, the same all the way up", d: "the slopes would depend only on $t$: flat along $t = 0$, rising to the right of it and falling to the left." },
    { tex: "y' = -t", f: (t, y) => -t, look: "flat along the vertical axis t = 0, falling to its right and rising to its left, the same all the way up", d: "the slopes would depend only on $t$: flat along $t = 0$, falling to the right of it and rising to the left." },
    { tex: "y' = 1", f: () => 1, look: "all parallel, each rising at the same angle", d: "every segment would point the same way, all rising at the same angle." },
    { tex: "y' = t + y", f: (t, y) => t + y, look: "flat along the diagonal line y = −t, rising above that line and falling below it", d: "the segments would be flat along the diagonal line $y = -t$, rising above it and falling below it." },
  ];
  function fieldSvg(F) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "plot field-thumb");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Slope field for t and y from minus 2 to 2. The segments are " + F.look + ".");
    const p = P.make(svg, { W: 220, H: 210, margin: { l: 40, r: 8, t: 8, b: 36 }, x: [-2, 2], y: [-2, 2], xticks: [-2, 0, 2], yticks: [-2, 0, 2], xlabel: "t", ylabel: "y", nogrid: true });
    p.seg(-2, 0, 2, 0, "axis0"); p.seg(0, -2, 0, 2, "axis0");
    p.field(F.f, 10, 10, 15);
    return svg.outerHTML;
  }
  function fieldQuestion(target, others) {
    const opts = [target].concat(others);
    return {
      prompt: "<p>Which equation has this slope field?</p>",
      figure: fieldSvg(target),
      kind: "mc", answer: 0,
      options: opts.map(F => ({ html: "$" + F.tex + "$", why: F === target ? null : "For $" + F.tex + "$, " + F.d + " Compare with the figure." })),
      review: { href: "#lesson2", label: "Lesson 2, Pictures of slopes" },
      explain: "<p>The segments are " + target.look.replace("y = −t", "$y = -t$").replace(/\b([ty]) = 0\b/g, "$$$1 = 0$$") + ". That is the field of $" + target.tex + "$.</p>",
    };
  }
  function genField() {
    const [target, ...rest] = shuffle(FIELDS);
    return fieldQuestion(target, rest.slice(0, 3));
  }

  /* ---------------- generators ---------------- */
  function slopeProblem() {
    const kind = pick(["decay", "logistic", "logistic", "fall", "cool", "tmy", "ty", "2tpy"]);
    if (kind === "decay") { const c = pick([0.1, 0.2, 0.5]), y = pick([10, 20, 50, 80, 200]); return { tex: "y' = -" + c + "\\,y", t: pick([0, 1, 3]), y, f: (t, y) => -c * y, show: (t, y) => "-" + c + " \\times " + y }; }
    if (kind === "logistic") {
      const r = pick([0.5, 1, 2]), M = pick([10, 50, 100]), y = r6(M * pick([0.1, 0.2, 0.4, 0.5, 0.8, 1.2]));
      return { tex: "y' = " + (r === 1 ? "" : r + "\\,") + "y\\,(1 - y/" + M + ")", t: pick([0, 2, 5]), y, f: (t, y) => r * y * (1 - y / M), show: (t, y) => (r === 1 ? "" : r + " \\times ") + y + " \\times (1 - " + y + "/" + M + ")", noFactor: r * y, M };
    }
    if (kind === "fall") { const c = pick([0.1, 0.2, 0.5]), v = pick([0, 10, 20, 30, 50]); return { tex: "y' = 9.8 - " + c + "\\,y", t: pick([0, 2, 4]), y: v, f: (t, y) => 9.8 - c * y, show: (t, y) => "9.8 - " + c + " \\times " + y }; }
    if (kind === "cool") { const c = pick([0.1, 0.2]), R = pick([20, 25]), y = pick([40, 60, 90]); return { tex: "y' = -" + c + "\\,(y - " + R + ")", t: pick([0, 5]), y, f: (t, y) => -c * (y - R), show: (t, y) => "-" + c + " \\times (" + y + " - " + R + ")" }; }
    const t = randInt(0, 3), y = randInt(-2, 4);
    if (kind === "tmy") return { tex: "y' = t - y", t, y, f: (t, y) => t - y, show: (t, y) => t + " - " + par(y), tdep: true };
    if (kind === "ty") return { tex: "y' = t\\,y", t: randInt(1, 3), y, f: (t, y) => t * y, show: (t, y) => t + " \\times " + par(y) };
    return { tex: "y' = 2t + y", t, y, f: (t, y) => 2 * t + y, show: (t, y) => "2 \\times " + t + " + " + par(y), tdep: true };
  }
  function genSlope() {
    let q, ans;
    do { q = slopeProblem(); ans = q.f(q.t, q.y); } while (q.tdep && near(q.f(q.y, q.t), ans, 1e-9) && q.t !== q.y);
    return {
      prompt: "<p>A solution of $" + q.tex + "$ passes through the point $(t, y) = (" + q.t + ", " + q.y + ")$. How fast is $y$ changing there?</p>",
      kind: "numbers", labels: ["slope ="], answer: [r6(ans)], tol: TOL,
      hint: "Put $t = " + q.t + "$ and $y = " + q.y + "$ into the right-hand side of the equation.",
      review: { href: "#lesson1", label: "Lesson 1, Rules about rates" },
      diagnose: v => {
        const x = v[0];
        if (ans !== 0 && near(x, -ans, TOL)) return "Check the sign. Work out the right-hand side step by step, keeping track of each minus sign.";
        if (q.noFactor !== undefined && near(x, q.noFactor, TOL)) return "Don't forget the factor $(1 - y/" + q.M + ")$: it is what slows the growth.";
        if (q.tdep && near(x, q.f(q.y, q.t), TOL)) return "Check which number is $t$ and which is $y$: the point is written $(t, y)$.";
        return null;
      },
      explain: "<p>$f(" + q.t + ", " + q.y + ") = " + q.show(q.t, q.y) + " = " + fmtD(ans) + "$." + (ans === 0 ? " A slope of zero: here the solution is momentarily flat." : "") + "</p>",
    };
  }

  const WORDS = [
    () => { const c = pick([0.1, 0.2, 0.3]); return {
      prompt: "<p>A drug leaves the bloodstream at a rate proportional to the amount $y$ present, with constant " + c + " per hour. Which equation says this?</p>",
      options: [
        { html: "$y' = -" + c + "\\,y$", why: null },
        { html: "$y' = " + c + "\\,y$", why: "With a plus sign the amount would grow. Which way is it going?" },
        { html: "$y' = -" + c + "$", why: "This says the amount falls at the same rate whatever the amount. The rule says the rate depends on the amount." },
        { html: "$y' = -" + c + "\\,t$", why: "This makes the rate depend on the time, not on the amount present." },
      ] }; },
    () => { const c = pick([0.03, 0.05]); return {
      prompt: "<p>Money in a savings account grows at a rate proportional to the balance $y$, with constant " + c + " per year. Which equation says this?</p>",
      options: [
        { html: "$y' = " + c + "\\,y$", why: null },
        { html: "$y' = " + c + "$", why: "This says the balance grows by the same amount each year, whatever the balance." },
        { html: "$y' = -" + c + "\\,y$", why: "With a minus sign the balance would shrink." },
        { html: "$y = " + c + "\\,y$", why: "This is not about a rate at all: it has no derivative in it." },
      ] }; },
    () => { const r = pick([2, 3, 5]); return {
      prompt: "<p>Water drains from a tank at a constant " + r + " liters per minute. If $y$ is the volume of water in liters, which equation says this?</p>",
      options: [
        { html: "$y' = -" + r + "$", why: null },
        { html: "$y' = -" + r + "\\,y$", why: "This makes the draining faster when there is more water. The rule says the rate is constant." },
        { html: "$y' = " + r + "$", why: "With a plus sign the tank would be filling up." },
        { html: "$y' = -" + r + "\\,t$", why: "This makes the draining speed up as time goes on. The rule says the rate is constant." },
      ] }; },
    () => { const R = pick([20, 22, 25]); return {
      prompt: "<p>A cup of tea cools at a rate proportional to how much hotter it is than the " + R + "° room, with constant 0.1 per minute. If $y$ is its temperature, which equation says this?</p>",
      options: [
        { html: "$y' = -0.1\\,(y - " + R + ")$", why: null },
        { html: "$y' = -0.1\\,y$", why: "This would cool the tea toward 0°, not toward the room temperature." },
        { html: "$y' = 0.1\\,(y - " + R + ")$", why: "Check the sign: if the tea is hotter than the room, $y - " + R + "$ is positive. Should $y'$ be positive or negative?" },
        { html: "$y' = -0.1\\,(y - " + R + ")\\,t$", why: "The rule doesn't mention time: the rate depends only on the temperature difference." },
      ] }; },
    () => { const M = pick([500, 1000, 2000]); return {
      prompt: "<p>A population $y$ grows at a rate proportional to its size, with constant 0.4 per year, but the growth slows to zero as $y$ approaches " + M + ". Which equation says this?</p>",
      options: [
        { html: "$y' = 0.4\\,y\\,(1 - y/" + M + ")$", why: null },
        { html: "$y' = 0.4\\,y$", why: "This population would keep growing faster and faster, with no limit." },
        { html: "$y' = 0.4\\,y\\,(1 + y/" + M + ")$", why: "What happens to the factor in brackets when $y$ is close to " + M + "? Growth should slow to zero there." },
        { html: "$y' = 0.4\\,(1 - y/" + M + ")$", why: "Here the rate is not proportional to the size: when $y$ is small, $y'$ is close to 0.4 whatever the population. The rule says the rate is proportional to the size." },
      ] }; },
  ];
  function genWords() {
    const q = pick(WORDS)();
    return Object.assign(q, { kind: "mc", answer: 0, review: { href: "#lesson1", label: "Lesson 1, the table of rules" },
      explain: "<p>Translate the rule piece by piece: the rate of change is $y'$; “proportional to” means a fixed number times; and a quantity that is decreasing needs a minus sign. That gives " + q.options[0].html + ".</p>" });
  }

  function expTex(c, a) {
    const ex = a === 1 ? "t" : a === -1 ? "-t" : fmtD(a) + "t";
    return (c === 1 ? "" : fmtD(c) + "\\,") + "e^{" + ex + "}";
  }
  function genSolves() {
    let a, b;
    do { a = pick([2, 3, -1, -2, 0.5]); b = randInt(1, 5); } while (Math.abs(a) === b);
    return {
      prompt: "<p>Which function solves the initial value problem $y' = " + (a === 1 ? "" : a === -1 ? "-" : fmtD(a)) + "y$, $y(0) = " + b + "$?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "$y = " + expTex(b, a) + "$", why: null },
        { html: "$y = " + expTex(a < 0 ? -a : a, b) + "$", why: "What is this function at $t = 0$? It should equal the starting value " + b + "." },
        { html: "$y = " + expTex(b, -a) + "$", why: "Differentiate it: its derivative is $" + fmtD(-a) + "$ times itself, not $" + fmtD(a) + "$ times itself." },
        { html: "$y = " + b + (a < 0 ? " - " : " + ") + (Math.abs(a) === 1 ? "" : fmtD(Math.abs(a))) + "t$", why: "Its derivative is the constant $" + fmtD(a) + "$, but the rule needs the derivative to be $" + fmtD(a) + "$ times $y$, which changes as $y$ changes." },
      ],
      review: { href: "#lesson1", label: "Lesson 1, What a solution is" },
      explain: "<p>Check both conditions. $y = " + expTex(b, a) + "$ has derivative $" + fmtD(a) + " \\times " + expTex(b, a) + " = " + fmtD(a) + "\\,y$, so it obeys the rule, and at $t = 0$ it equals $" + b + "$.</p>",
    };
  }

  function genEquilibrium() {
    const kind = pick(["logistic", "cool", "fall"]);
    let tex, ans, show, extra = "", wrongs = [];
    if (kind === "logistic") { const r = pick([0.5, 1, 2]), M = pick([50, 80, 100, 500]); tex = "y' = " + (r === 1 ? "" : r + "\\,") + "y\\,(1 - y/" + M + ")"; ans = M; extra = " (There are two; give the one that is not zero.)"; show = "<p>The slope is zero when $y = 0$ or when $1 - y/" + M + " = 0$, that is $y = " + M + "$.</p>"; }
    else if (kind === "cool") { const c = pick([0.1, 0.2, 0.5]), R = pick([18, 20, 22, 25]); tex = "y' = -" + c + "\\,(y - " + R + ")"; ans = R; show = "<p>The slope is zero when $y - " + R + " = 0$, that is $y = " + R + "$: the room temperature.</p>"; }
    else { const g = pick([9.8, 10]), c = pick([0.1, 0.2, 0.25, 0.5]); tex = "y' = " + g + " - " + c + "\\,y"; ans = r6(g / c); wrongs = [g * c, g]; show = "<p>The slope is zero when $" + g + " - " + c + "\\,y = 0$, that is $y = " + g + " / " + c + " = " + fmtD(ans) + "$.</p>"; }
    return {
      prompt: "<p>Find the steady state of $" + tex + "$: the constant value of $y$ at which the solution never changes." + extra + "</p>",
      kind: "numbers", labels: ["$y =$"], answer: [ans], tol: 0.01,
      hint: "A solution that never changes has slope zero. Set the right-hand side equal to zero and solve for $y$.",
      review: { href: "#steady-states", label: "Lesson 2, Flat lines: steady states" },
      diagnose: v => {
        if (kind === "logistic" && near(v[0], 0, 0.01)) return "That one works too. Find the other value where the slope is zero.";
        if (wrongs.some(w => near(v[0], w, 0.01))) return "Set the right-hand side equal to zero and solve for $y$: the constant term must balance the term with $y$.";
        return null;
      },
      explain: show,
    };
  }

  const CONCEPTS = [
    () => ({
      prompt: "<p>Two students use the same differential equation and both compute correctly, but they get different solution curves. What is the most likely reason?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "They used different starting values", why: null },
        { html: "One of them made a mistake", why: "The question says both computed correctly. How many curves does a slope field have?" },
        { html: "The equation has no solution", why: "It has many solutions; both of their curves can be solutions." },
        { html: "Their slope fields are different", why: "A slope field comes from the equation alone, and they used the same equation." },
      ],
      review: { href: "#lesson3", label: "Lesson 3, One curve" },
      explain: "<p>A differential equation has a whole family of solutions, one through every starting point. A starting value picks out one curve, so different starting values give different curves.</p>",
    }),
    () => ({
      prompt: "<p>What do you need to give a numerical ODE solver?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "The slope function $f$, the starting value $\\alpha$, and the end time", why: null },
        { html: "A formula for the solution", why: "If you had a formula, you would not need a solver: you could just evaluate it." },
        { html: "A picture of the slope field", why: "A slope field is a picture for people. What does the solver actually compute with?" },
        { html: "The value of $y$ at the end time", why: "That is usually what you want the solver to find." },
      ],
      review: { href: "#lesson3", label: "Lesson 3, the solver's job" },
      explain: "<p>A solver needs to be able to compute slopes, so it needs $f$; it needs to know where to start, $\\alpha$; and it needs to know how far to go.</p>",
    }),
    () => ({
      prompt: "<p>What does a numerical ODE solver give back?</p>",
      kind: "mc", answer: 0,
      options: [
        { html: "A table of times, with an approximate value of $y$ at each", why: null },
        { html: "A formula for $y(t)$", why: "A numerical solver works only with numbers." },
        { html: "The exact value of $y$ at every time", why: "Does it work at every time, and are its values exact?" },
        { html: "The slope field", why: "The slope field can be drawn from $f$ directly. A solver uses $f$ to build something else." },
      ],
      review: { href: "#lesson3", label: "Lesson 3, the solver's job" },
      explain: "<p>A solver steps from $t_0$ to the end time and records an approximate value $y_j$ at each time $t_j$ it reaches, starting from $y_0 = \\alpha$: a table, not a formula.</p>",
    }),
  ];

  /* ---------------- quick checks ---------------- */
  const QC1 = {
    prompt: "<p>For the fish, $y' = 0.5\\,y\\,(1 - y/100)$. How fast is the population growing, in fish per year, when there are $y = 40$ fish?</p>",
    kind: "numbers", labels: ["$y' =$"], answer: [12], tol: TOL,
    hint: "Put $y = 40$ into the right-hand side. Work out the bracket first.",
    diagnose: v => {
      if (near(v[0], 20, TOL)) return "Don't forget the factor $(1 - y/100)$: it is what slows the growth.";
      if (near(v[0], -12, TOL)) return "Check the sign: with 40 fish the bracket is positive.";
      return null;
    },
    explain: "<p>$0.5 \\times 40 \\times (1 - 40/100) = 20 \\times 0.6 = 12$ fish per year.</p>",
  };

  document.addEventListener("DOMContentLoaded", () => {
    explorer(document.getElementById("ex-field"));
    L.quick(document.getElementById("qc1"), QC1);
    L.quick(document.getElementById("qc2"), fieldQuestion(FIELDS[1], [FIELDS[0], FIELDS[2], FIELDS[4]]));
    L.quick(document.getElementById("qc3"), CONCEPTS[0]());
    L.practice(document.getElementById("practice"), [genSlope, genSlope, genField, genField, genWords, genSolves, genEquilibrium, () => pick(CONCEPTS)()]);
    L.moduleCheck(document.getElementById("check"), "m01", () => [genSlope(), genField(), genWords(), pick([genSolves, genEquilibrium])(), pick(CONCEPTS)()]);
    L.renderMath(document.getElementById("main"));
  });
})();
