// Mandelbrot fractal module
(() => {
    const mandelbrotConfig = {
        maxIterationsBase: 500, // will scale with zoom
        escapeRadius: 4.0,
        colorScale: 12.0,
    };

    function defaultView(aspect) {
        const ySpan = 3.0; // from -1.5 to 1.5
        const xSpan = ySpan * aspect;
        const xCenter = -0.75;
        const yCenter = 0.0;
        return {
            xMin: xCenter - xSpan / 2,
            xMax: xCenter + xSpan / 2,
            yMin: yCenter - ySpan / 2,
            yMax: yCenter + ySpan / 2,
        };
    }

    function render({ canvas, ctx, view, helpers }) {
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
                    const logZn = Math.log(x2 + y2) / 2;
                    const nu = Math.log(logZn / Math.log(2)) / Math.log(2);
                    const smoothIter = iter + 1 - nu;

                    const hue = (240 + colorScale * smoothIter) % 360;
                    const [rr, gg, bb] = helpers.hslToRgb(hue / 360, 0.6, 0.5);
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

    (window.Fractals ||= {}).mandelbrot = {
        name: 'Mandelbrot',
        defaultView,
        render
    };
})();