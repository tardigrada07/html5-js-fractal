// Fractal Viewer - plain JS

(() => {
    const canvas = document.getElementById('fractalCanvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const select = document.getElementById('fractalSelect');

    // Track device pixel ratio for crisp rendering
    const DPR = () => (window.devicePixelRatio || 1);

    // World/view rectangle in fractal coordinates
    // Represented as { xMin, xMax, yMin, yMax }
    let view = null;

    // Fractal type: 'mandelbrot' | 'sierpinski'
    let fractal = select.value;

    // Drag selection
    let isDragging = false;
    let dragStart = null;
    let selectionEl = null;

    // For Mandelbrot rendering
    const mandelbrotConfig = {
        maxIterationsBase: 500, // will scale with zoom
        escapeRadius: 4.0,
        colorScale: 12.0,
    };

    // Initial views per fractal
    function defaultViewFor(fractalName, aspect) {
        if (fractalName === 'mandelbrot') {
            // Base view keeping aspect ratio
            const ySpan = 3.0; // from -1.5 to 1.5
            const xSpan = ySpan * aspect;
            const xCenter = -0.75; // a nice center
            const yCenter = 0.0;
            return {
                xMin: xCenter - xSpan / 2,
                xMax: xCenter + xSpan / 2,
                yMin: yCenter - ySpan / 2,
                yMax: yCenter + ySpan / 2,
            };
        } else {
            // Sierpinski triangle spanning a canonical triangle
            // Map an equilateral-ish triangle within [0,1] in Y and expand X by aspect
            const ySpan = 1.2;
            const xSpan = ySpan * aspect;
            const xCenter = 0.5;
            const yCenter = 0.5;
            return {
                xMin: xCenter - xSpan / 2,
                xMax: xCenter + xSpan / 2,
                yMin: yCenter - ySpan / 2,
                yMax: yCenter + ySpan / 2,
            };
        }
    }

    function resizeCanvas() {
        const dpr = DPR();
        const wCss = window.innerWidth;
        const hCss = window.innerHeight;
        canvas.style.width = wCss + 'px';
        canvas.style.height = hCss + 'px';
        canvas.width = Math.max(1, Math.floor(wCss * dpr));
        canvas.height = Math.max(1, Math.floor(hCss * dpr));

        // Adjust view to maintain center and aspect ratio
        const aspect = canvas.width / canvas.height;
        if (!view) {
            view = defaultViewFor(fractal, aspect);
        } else {
            const cx = (view.xMin + view.xMax) / 2;
            const ySpan = view.yMax - view.yMin;
            const xSpan = ySpan * aspect;
            view.xMin = cx - xSpan / 2;
            view.xMax = cx + xSpan / 2;
        }
        scheduleRender();
    }

    // Convert canvas pixel to fractal coords
    function screenToWorld(px, py) {
        const x = view.xMin + (px / canvas.width) * (view.xMax - view.xMin);
        const y = view.yMin + (py / canvas.height) * (view.yMax - view.yMin);
        return { x, y };
    }

    // Zoom keeping a point (cx, cy) fixed in world coords
    // Numerically stable even at very deep zoom; avoids stalling when spans get tiny.
    function zoomAt(worldX, worldY, scale) {
        const oldXSpan = view.xMax - view.xMin;
        const oldYSpan = view.yMax - view.yMin;

        // Position of the cursor within the view [0..1]
        const tX = (oldXSpan > 0) ? (worldX - view.xMin) / oldXSpan : 0.5;
        const tY = (oldYSpan > 0) ? (worldY - view.yMin) / oldYSpan : 0.5;

        let newXSpan = oldXSpan * scale;
        let newYSpan = oldYSpan * scale;

        // If rounding prevents change, force a tiny step to keep zoom responsive
        if (newXSpan === oldXSpan) newXSpan = oldXSpan * (scale < 1 ? (1 - 1e-6) : (1 + 1e-6));
        if (newYSpan === oldYSpan) newYSpan = oldYSpan * (scale < 1 ? (1 - 1e-6) : (1 + 1e-6));

        // Prevent zero/negative spans
        const EPS = Number.EPSILON * 1e6;
        newXSpan = Math.max(newXSpan, EPS);
        newYSpan = Math.max(newYSpan, EPS);

        // Recompute view so that worldX/worldY keep their relative location
        view.xMin = worldX - tX * newXSpan;
        view.xMax = view.xMin + newXSpan;
        view.yMin = worldY - tY * newYSpan;
        view.yMax = view.yMin + newYSpan;

        scheduleRender();
    }

    // Zoom to a rectangular world area
    function zoomToRect(xMin, xMax, yMin, yMax) {
        // Normalize
        const xmin = Math.min(xMin, xMax);
        const xmax = Math.max(xMin, xMax);
        const ymin = Math.min(yMin, yMax);
        const ymax = Math.max(yMin, yMax);

        // Adjust to canvas aspect ratio
        const targetAspect = canvas.width / canvas.height;
        let xSpan = xmax - xmin;
        let ySpan = ymax - ymin;
        const currentAspect = xSpan / ySpan;

        if (currentAspect > targetAspect) {
            // Too wide: expand y
            const newYSpan = xSpan / targetAspect;
            const cy = (ymin + ymax) / 2;
            view = { xMin: xmin, xMax: xmax, yMin: cy - newYSpan / 2, yMax: cy + newYSpan / 2 };
        } else {
            // Too tall: expand x
            const newXSpan = ySpan * targetAspect;
            const cx = (xmin + xmax) / 2;
            view = { xMin: cx - newXSpan / 2, xMax: cx + newXSpan / 2, yMin: ymin, yMax: ymax };
        }

        // Ensure spans never collapse due to precision
        const EPS = Number.EPSILON * 1e6;
        if (view.xMax - view.xMin < EPS) {
            const cx = (view.xMin + view.xMax) / 2;
            view.xMin = cx - EPS / 2;
            view.xMax = cx + EPS / 2;
        }
        if (view.yMax - view.yMin < EPS) {
            const cy = (view.yMin + view.yMax) / 2;
            view.yMin = cy - EPS / 2;
            view.yMax = cy + EPS / 2;
        }

        scheduleRender();
    }

    // Rendering scheduler (debounce rapid calls)
    let renderPending = false;
    function scheduleRender() {
        if (renderPending) return;
        renderPending = true;
        requestAnimationFrame(() => {
            renderPending = false;
            render();
        });
    }

    function render() {
        if (fractal === 'mandelbrot') {
            renderMandelbrot();
        } else {
            renderSierpinski();
        }
    }

    // Mandelbrot rendering using escape-time algorithm
    function renderMandelbrot() {
        const { width: W, height: H } = canvas;
        const img = ctx.createImageData(W, H);
        const data = img.data;

        const xMin = view.xMin, xMax = view.xMax;
        const yMin = view.yMin, yMax = view.yMax;
        const xScale = (xMax - xMin) / Math.max(1, (W - 1));
        const yScale = (yMax - yMin) / Math.max(1, (H - 1));

        // Increase iterations when zoomed in
        const span = Math.max(xMax - xMin, yMax - yMin);
        const maxIter = Math.min(4000, Math.floor(mandelbrotConfig.maxIterationsBase * (3.0 / Math.max(1e-18, span))));

        const escapeR2 = mandelbrotConfig.escapeRadius;
        const colorScale = mandelbrotConfig.colorScale;

        let idx = 0;
        for (let j = 0; j < H; j++) {
            const cy = yMin + j * yScale;
            for (let i = 0; i < W; i++) {
                const cx = xMin + i * xScale;
                let x = 0, y = 0;
                let iter = 0;
                let x2 = 0, y2 = 0;

                while (x2 + y2 <= escapeR2 && iter < maxIter) {
                    y = 2 * x * y + cy;
                    x = x2 - y2 + cx;
                    x2 = x * x;
                    y2 = y * y;
                    iter++;
                }

                let r, g, b;
                if (iter === maxIter) {
                    r = g = b = 0; // inside: black
                } else {
                    // Smooth coloring
                    const logZn = Math.log(x2 + y2) / 2;
                    const nu = Math.log(logZn / Math.log(2)) / Math.log(2);
                    const smoothIter = iter + 1 - nu;

                    const hue = (240 + colorScale * smoothIter) % 360;
                    const [rr, gg, bb] = hslToRgb(hue / 360, 0.6, 0.5);
                    r = rr; g = gg; b = bb;
                }

                data[idx++] = r;
                data[idx++] = g;
                data[idx++] = b;
                data[idx++] = 255; // alpha
            }
        }

        ctx.putImageData(img, 0, 0);
    }

    // Sierpinski rendering using zoom-proof bit-by-bit refinement
    function renderSierpinski() {
        const { width: W, height: H } = canvas;

        // Triangle vertices in world coordinates
        const A = { x: 0.5, y: 0.05 };
        const B = { x: 0.05, y: 0.95 };
        const C = { x: 0.95, y: 0.95 };

        // Edge vectors
        const e1 = { x: B.x - A.x, y: B.y - A.y };
        const e2 = { x: C.x - A.x, y: C.y - A.y };

        // Inverse of the 2x2 matrix [e1 e2] to convert P -> (s,t) with P = A + s*e1 + t*e2
        const det = e1.x * e2.y - e1.y * e2.x;
        if (Math.abs(det) < 1e-20) {
            ctx.clearRect(0, 0, W, H);
            return;
        }
        const inv = {
            a:  e2.y / det,  b: -e2.x / det,
            c: -e1.y / det,  d:  e1.x / det
        };

        // Pixel size in world units
        const xMin = view.xMin, xMax = view.xMax;
        const yMin = view.yMin, yMax = view.yMax;
        const xScale = (xMax - xMin) / Math.max(1, (W - 1));
        const yScale = (yMax - yMin) / Math.max(1, (H - 1));
        const pxWorld = Math.min(xScale, yScale);

        // Triangle span (use longer edge)
        const triSpan = Math.max(Math.hypot(e1.x, e1.y), Math.hypot(e2.x, e2.y));

        // Choose the number of binary refinement steps N so smallest triangles ~ pixel size.
        // triSpan / 2^N ~ pxWorld => N ~ log2(triSpan / pxWorld)
        let N = Math.floor(Math.log2(Math.max(1e-18, triSpan / Math.max(1e-18, pxWorld))));
        N = Math.max(1, Math.min(30, N)); // 30 bits keeps operations in fast 32-bit shifts

        const img = ctx.createImageData(W, H);
        const buf = img.data;

        // Palette
        const baseColor = { r: 200, g: 220, b: 255 };
        const holeColor = { r: 0, g: 0, b: 0 };

        function brightness(iBits, jBits) {
            // Subtle variation using trailing zeros in (i|j)
            let v = (iBits | jBits) | 1;
            let tz = 0;
            while ((v & 1) === 0 && tz < 10) { v >>>= 1; tz++; }
            return 1 - tz * 0.07;
        }

        let idx = 0;
        for (let py = 0; py < H; py++) {
            const wy = yMin + py * yScale;
            for (let px = 0; px < W; px++) {
                const wx = xMin + px * xScale;

                // Convert to (s,t)
                const dx = wx - A.x;
                const dy = wy - A.y;
                let s = inv.a * dx + inv.b * dy;
                let t = inv.c * dx + inv.d * dy;

                if (s >= 0 && t >= 0 && s + t <= 1) {
                    // Build i/j indices from the first N bits of s and t (binary refinement)
                    let iBits = 0 | 0;
                    let jBits = 0 | 0;
                    let ss = s;
                    let tt = t;
                    for (let k = 0; k < N; k++) {
                        ss *= 2;
                        tt *= 2;
                        const ib = (ss >= 1) ? 1 : 0;
                        const jb = (tt >= 1) ? 1 : 0;
                        iBits = (iBits << 1) | ib;
                        jBits = (jBits << 1) | jb;
                        if (ib) ss -= 1;
                        if (jb) tt -= 1;
                    }

                    if ((iBits & jBits) === 0) {
                        const br = brightness(iBits, jBits);
                        buf[idx]     = (baseColor.r * br) | 0;
                        buf[idx + 1] = (baseColor.g * br) | 0;
                        buf[idx + 2] = (baseColor.b * br) | 0;
                        buf[idx + 3] = 255;
                    } else {
                        buf[idx]     = holeColor.r;
                        buf[idx + 1] = holeColor.g;
                        buf[idx + 2] = holeColor.b;
                        buf[idx + 3] = 255;
                    }
                } else {
                    buf[idx]     = 0;
                    buf[idx + 1] = 0;
                    buf[idx + 2] = 0;
                    buf[idx + 3] = 255;
                }

                idx += 4;
            }
        }

        ctx.putImageData(img, 0, 0);
    }

    // Helpers
    function hslToRgb(h, s, l) {
        // h in [0,1], s,l in [0,1]
        let r, g, b;
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return [(r * 255) | 0, (g * 255) | 0, (b * 255) | 0];
    }

    // Mouse drag to select a rectangle and zoom
    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        const rect = canvas.getBoundingClientRect();
        const dpr = DPR();
        dragStart = {
            x: (e.clientX - rect.left) * dpr,
            y: (e.clientY - rect.top) * dpr,
        };

        selectionEl = document.createElement('div');
        selectionEl.className = 'selection-rect';
        document.body.appendChild(selectionEl);
        updateSelectionRect(dragStart.x, dragStart.y, dragStart.x, dragStart.y);
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = DPR();
        const x = (e.clientX - rect.left) * dpr;
        const y = (e.clientY - rect.top) * dpr;
        updateSelectionRect(dragStart.x, dragStart.y, x, y);
    });

    window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;

        const rect = canvas.getBoundingClientRect();
        const dpr = DPR();
        const endX = (e.clientX - rect.left) * dpr;
        const endY = (e.clientY - rect.top) * dpr;

        if (selectionEl) {
            selectionEl.remove();
            selectionEl = null;
        }

        // If the selection is too small, ignore
        const dx = Math.abs(endX - dragStart.x);
        const dy = Math.abs(endY - dragStart.y);
        if (dx < 5 * dpr || dy < 5 * dpr) return;

        // Convert selection rect to world coords
        const p0 = screenToWorld(dragStart.x, dragStart.y);
        const p1 = screenToWorld(endX, endY);
        zoomToRect(p0.x, p1.x, p0.y, p1.y);
    });

    function updateSelectionRect(x0, y0, x1, y1) {
        const dpr = DPR();
        const rect = canvas.getBoundingClientRect();
        const toCss = (v, isY = false) => (v / dpr) + (isY ? rect.top : rect.left);

        const left = Math.min(x0, x1);
        const top = Math.min(y0, y1);
        const width = Math.abs(x1 - x0);
        const height = Math.abs(y1 - y0);

        if (!selectionEl) return;
        selectionEl.style.left = `${toCss(left)}px`;
        selectionEl.style.top = `${toCss(top, true)}px`;
        selectionEl.style.width = `${width / dpr}px`;
        selectionEl.style.height = `${height / dpr}px`;
    }

    select.addEventListener('change', () => {
        fractal = select.value;
        // Reset view to default for the chosen fractal
        view = defaultViewFor(fractal, canvas.width / canvas.height);
        scheduleRender();
    });

    window.addEventListener('resize', resizeCanvas, { passive: true });

    // Init
    resizeCanvas();
})();