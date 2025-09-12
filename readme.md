# HTML5 JS Fractal Viewer

An interactive, browser-based fractal viewer built with HTML5 Canvas, vanilla JavaScript, and simple CSS. Open the included HTML file in any modern browser to render and explore fractal imagery.

## Highlights

- Pure client-side (no build tools required)
- Renders fractals on an HTML5 Canvas
- Adjustable visual parameters (iterations, colors, scale) via source settings
- Lightweight, minimal dependencies
- Works offline when opened locally

## Project Structure

- FractalViewer.html — Entry point; bootstraps the canvas and UI.
- FractalRenderer.js — Rendering logic and fractal computation.
- FractalCanvasStyles.css — Basic styles for the viewer and canvas.

## Quick Start

1. Download or clone this repository.
2. Open `FractalViewer.html` in a modern browser (Chrome, Firefox, Safari, Edge).

## Usage

- Launch the viewer as described above.
- Interact with the canvas to explore the fractal (zoom/pan and other interactions depend on the current UI and implementation).
- For customization:
    - Open `FractalRenderer.js` to adjust defaults such as iteration limits, zoom scales, and color palettes.
    - Update `FractalCanvasStyles.css` to tweak layout and appearance.

## Performance Tips

- Lower the maximum iteration count for smoother interaction on lower-end devices.
- Reduce canvas resolution (width/height) to increase rendering speed.
- Avoid running multiple heavy tabs while exploring deep zooms.
