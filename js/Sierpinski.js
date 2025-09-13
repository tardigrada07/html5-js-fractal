// Sierpinski triangle module
(() => {
    function defaultView(aspect) {
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

    function render({ canvas, ctx, view }) {
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

        // Choose N so smallest triangles ~ pixel size.
        let N = Math.floor(Math.log2(Math.max(1e-18, triSpan / Math.max(1e-18, pxWorld))));
        N = Math.max(1, Math.min(30, N));

        const img = ctx.createImageData(W, H);
        const buf = img.data;

        // Palette
        const baseColor = { r: 200, g: 220, b: 255 };
        const holeColor = { r: 0, g: 0, b: 0 };

        function brightness(iBits, jBits) {
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

    (window.Fractals ||= {}).sierpinski = {
        name: 'Sierpinski',
        defaultView,
        render
    };
})();