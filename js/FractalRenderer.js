// Fractal Viewer - modular JS with rendering status indicator

(() => {
    const canvas = document.getElementById('fractalCanvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const select = document.getElementById('fractalSelect');
    const statusEl = document.getElementById('status');

    // Track device pixel ratio for crisp rendering
    const DPR = () => (window.devicePixelRatio || 1);

    // World/view rectangle in fractal coordinates
    // Represented as { xMin, xMax, yMin, yMax }
    let view = null;

    // Fractal registry from per-fractal JS modules
    const registry = (window.Fractals ||= {});
    let fractal = select.value;

    // Drag selection
    let isDragging = false;
    let dragStart = null;
    let selectionEl = null;

    function defaultViewFor(fractalName, aspect) {
        const f = registry[fractalName];
        if (f && typeof f.defaultView === 'function') {
            return f.defaultView(aspect);
        }
        // Fallback: centered unit square honoring aspect
        const ySpan = 1;
        const xSpan = ySpan * aspect;
        const cx = 0, cy = 0;
        return { xMin: cx - xSpan / 2, xMax: cx + xSpan / 2, yMin: cy - ySpan / 2, yMax: cy + ySpan / 2 };
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

    // Convert world coords to canvas pixel
    function worldToScreen(wx, wy) {
        const px = (wx - view.xMin) / (view.xMax - view.xMin) * canvas.width;
        const py = (wy - view.yMin) / (view.yMax - view.yMin) * canvas.height;
        return { x: px, y: py };
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

    // Rendering scheduler (debounce rapid calls) + busy indicator
    let renderPending = false;
    let busyDepth = 0;
    function setBusy(on) {
        if (!statusEl) return;
        if (on) {
            busyDepth++;
            statusEl.hidden = false;
        } else {
            busyDepth = Math.max(0, busyDepth - 1);
            if (busyDepth === 0) {
                // Small delay to avoid flicker on very fast renders
                const el = statusEl;
                setTimeout(() => { if (busyDepth === 0) el.hidden = true; }, 80);
            }
        }
    }
    function scheduleRender() {
        if (renderPending) return;
        renderPending = true;
        setBusy(true);
        requestAnimationFrame(() => {
            renderPending = false;
            // Allow the status to paint before heavy work
            requestAnimationFrame(() => {
                render();
                setBusy(false);
            });
        });
    }

    function render() {
        const f = registry[fractal];
        if (!f || typeof f.render !== 'function') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        f.render({
            canvas,
            ctx,
            view,
            helpers: { hslToRgb, worldToScreen },
        });
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

    // Init (wait until fractal modules are available)
    resizeCanvas();
})();