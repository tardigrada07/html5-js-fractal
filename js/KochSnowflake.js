// Koch Snowflake module (vector lines, zoomable)
(() => {
    function defaultView(aspect) {
        // Place an equilateral triangle fitting nicely; keep some padding
        const ySpan = 1.4;
        const xSpan = ySpan * aspect;
        const xCenter = 0.0;
        const yCenter = 0.0;
        return {
            xMin: xCenter - xSpan / 2,
            xMax: xCenter + xSpan / 2,
            yMin: yCenter - ySpan / 2,
            yMax: yCenter + ySpan / 2,
        };
    }

    // Generate Koch segments to a depth that roughly matches current pixel size
    function generateSegments(depth, p0, p1, out) {
        if (depth <= 0) {
            out.push([p0.x, p0.y, p1.x, p1.y]);
            return;
        }
        const dx = (p1.x - p0.x) / 3;
        const dy = (p1.y - p0.y) / 3;
        const a = { x: p0.x + dx,     y: p0.y + dy     };
        const b = { x: p0.x + 2*dx,   y: p0.y + 2*dy   };
        // Peak point forming an equilateral triangle
        const angle = Math.PI / 3; // 60 degrees
        const vx = b.x - a.x;
        const vy = b.y - a.y;
        const peak = {
            x: a.x + vx * Math.cos(angle) - vy * Math.sin(angle),
            y: a.y + vx * Math.sin(angle) + vy * Math.cos(angle),
        };
        generateSegments(depth - 1, p0, a, out);
        generateSegments(depth - 1, a, peak, out);
        generateSegments(depth - 1, peak, b, out);
        generateSegments(depth - 1, b, p1, out);
    }

    function estimateDepth(view, canvas) {
        // Choose depth so that smallest segments are ~ 2 pixels or larger
        const W = canvas.width, H = canvas.height;
        const xSpan = (view.xMax - view.xMin);
        const ySpan = (view.yMax - view.yMin);
        const pixelWorld = Math.min(xSpan / Math.max(1, W), ySpan / Math.max(1, H));
        // Base triangle side length in world units (we'll set ~2 units wide)
        const side = 2.0;
        // After depth n, segment length ~ side / 3^n
        // side / 3^n ≈ 2 * pixelWorld  => n ≈ log3(side / (2*pixelWorld))
        const n = Math.log(Math.max(1e-12, side / Math.max(1e-12, 2 * pixelWorld))) / Math.log(3);
        return Math.max(0, Math.min(8, Math.floor(n)));
    }

    function render({ canvas, ctx, view, helpers }) {
        const { width: W, height: H } = canvas;
        ctx.clearRect(0, 0, W, H);

        // Build an equilateral base triangle centered near (0, 0) with side ~ 2.0
        const side = 2.0;
        const h = Math.sqrt(3) / 2 * side;
        const A = { x: -side / 2, y: -h / 3 };
        const B = { x:  side / 2, y: -h / 3 };
        const C = { x:  0,        y:  2 * h / 3 };

        // Determine depth from zoom level
        const depth = estimateDepth(view, canvas);

        // Generate segments for all three edges
        const segments = [];
        generateSegments(depth, A, B, segments);
        generateSegments(depth, B, C, segments);
        generateSegments(depth, C, A, segments);

        // Draw
        ctx.lineWidth = Math.max(1, Math.floor(Math.min(W, H) * 0.0015));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Soft icy blue color
        ctx.strokeStyle = '#9fd3ff';
        ctx.beginPath();

        for (const [x0, y0, x1, y1] of segments) {
            const p0 = helpers.worldToScreen(x0, y0);
            const p1 = helpers.worldToScreen(x1, y1);
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
        }

        ctx.stroke();
    }

    (window.Fractals ||= {}).koch = {
        name: 'Koch Snowflake',
        defaultView,
        render
    };
})();