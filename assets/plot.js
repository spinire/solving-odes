/* Solving ODEs Numerically — tiny SVG plotting helper (linear or log axes, theme-aware via CSS classes). */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";

  function add(parent, tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    parent.appendChild(e);
    return e;
  }
  function fmtTick(v) {
    if (Math.abs(v) >= 1 || v === 0) return String(Math.round(v * 1000) / 1000);
    return String(Number(v.toPrecision(3)));
  }

  /* opts: { W, H, margin, x:[min,max], y:[min,max], xlog, ylog, xticks:[], yticks:[], xlabel, ylabel } */
  function make(svg, opts) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = opts.W || 380, H = opts.H || 240;
    const m = Object.assign({ l: 48, r: 14, t: 12, b: 42 }, opts.margin || {});
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    const tx = v => (opts.xlog ? Math.log10(v) : v), ty = v => (opts.ylog ? Math.log10(v) : v);
    const x0 = tx(opts.x[0]), x1 = tx(opts.x[1]), y0 = ty(opts.y[0]), y1 = ty(opts.y[1]);
    const X = v => m.l + (tx(v) - x0) / (x1 - x0) * (W - m.l - m.r);
    const Y = v => H - m.b - (ty(v) - y0) / (y1 - y0) * (H - m.t - m.b);

    const grid = add(svg, "g", { "aria-hidden": "true" });
    (opts.xticks || []).forEach(v => {
      if (!opts.nogrid) add(grid, "line", { class: "gridline", x1: X(v), x2: X(v), y1: m.t, y2: H - m.b });
      add(grid, "text", { x: X(v), y: H - m.b + 15, "text-anchor": "middle", class: "tick" }, fmtTick(v));
    });
    (opts.yticks || []).forEach(v => {
      if (!opts.nogrid) add(grid, "line", { class: "gridline", x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) });
      add(grid, "text", { x: m.l - 6, y: Y(v) + 4, "text-anchor": "end", class: "tick" }, (opts.yfmt || fmtTick)(v));
    });
    add(grid, "line", { class: "axis", x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b });
    add(grid, "line", { class: "axis", x1: m.l, x2: m.l, y1: m.t, y2: H - m.b });
    if (opts.xlabel) add(grid, "text", { x: (m.l + W - m.r) / 2, y: H - 6, "text-anchor": "middle", class: "axislabel" }, opts.xlabel);
    if (opts.ylabel) {
      const short = opts.ylabel.length <= 2, cy = (m.t + H - m.b) / 2;
      add(grid, "text", { x: 12, y: cy + (short ? 4 : 0), "text-anchor": "middle", class: "axislabel", transform: short ? null : "rotate(-90 12 " + cy + ")" }, opts.ylabel);
    }

    let clipId = null;
    if (opts.clip) {
      clipId = "clip" + Math.random().toString(36).slice(2, 9);
      const defs = add(svg, "defs");
      const cp = add(defs, "clipPath", { id: clipId });
      add(cp, "rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b });
    }
    const layer = add(svg, "g", { "aria-hidden": "true", "clip-path": clipId ? "url(#" + clipId + ")" : null });
    function path(points, cls) {
      const d = points.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(2) + "," + Y(p[1]).toFixed(2)).join("");
      return add(layer, "path", { d, class: cls });
    }
    function curve(fn, a, b, n, cls) {
      const pts = [];
      for (let i = 0; i <= n; i++) { const t = a + (b - a) * i / n; pts.push([t, fn(t)]); }
      return path(pts, cls);
    }
    function dot(x, y, cls, r) { return add(layer, "circle", { cx: X(x), cy: Y(y), r: r || 4, class: cls }); }
    /* marker shapes, so series can be told apart without colour: circle, square, diamond */
    function marker(x, y, shape, cls, r) {
      r = r || 4; const cx = X(x), cy = Y(y);
      if (shape === "square") return add(layer, "rect", { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, class: cls });
      if (shape === "diamond") { const q = r * 1.35; return add(layer, "polygon", { points: [cx, cy - q, cx + q, cy, cx, cy + q, cx - q, cy].join(" "), class: cls }); }
      return add(layer, "circle", { cx, cy, r, class: cls });
    }
    function seg(xa, ya, xb, yb, cls) { return add(layer, "line", { x1: X(xa), y1: Y(ya), x2: X(xb), y2: Y(yb), class: cls }); }
    function label(x, y, text, cls, dx, dy, anchor) {
      return add(layer, "text", { x: X(x) + (dx || 0), y: Y(y) + (dy || 0), class: "lbl " + (cls || ""), "text-anchor": anchor || "start" }, text);
    }
    function clear() { while (layer.firstChild) layer.removeChild(layer.firstChild); }
    /* inverse maps (linear axes only), for turning a click into data coordinates */
    const Xinv = px => opts.x[0] + (px - m.l) / (W - m.l - m.r) * (opts.x[1] - opts.x[0]);
    const Yinv = py => opts.y[0] + (H - m.b - py) / (H - m.t - m.b) * (opts.y[1] - opts.y[0]);
    /* slope field: a short segment of slope f(t, y) at each grid point (linear axes only) */
    /* segments sit on the interior grid lines i/nx, j/ny (i = 1..nx-1), so round values such as y = 0 get a row */
    function field(f, nx, ny, len, cls) {
      const g = add(layer, "g", { class: cls || "field" });
      const sx = X(1) - X(0), sy = Y(0) - Y(1);
      for (let i = 1; i < nx; i++) for (let j = 1; j < ny; j++) {
        const t = opts.x[0] + i / nx * (opts.x[1] - opts.x[0]);
        const y = opts.y[0] + j / ny * (opts.y[1] - opts.y[0]);
        const s = f(t, y);
        let dx = sx, dy = -sy * s;
        const n = Math.hypot(dx, dy) || 1; dx *= len / 2 / n; dy *= len / 2 / n;
        add(g, "line", { x1: (X(t) - dx).toFixed(2), y1: (Y(y) - dy).toFixed(2), x2: (X(t) + dx).toFixed(2), y2: (Y(y) + dy).toFixed(2) });
      }
      return g;
    }
    return { X, Y, Xinv, Yinv, W, H, m, path, curve, dot, marker, seg, label, clear, field, layer, add };
  }

  window.ODEPlot = { make, add };
})();
