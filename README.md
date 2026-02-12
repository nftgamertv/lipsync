# Live Avatar Lip Sync

Browser-based real-time mouth animation for streaming and OBS overlays. Uses your microphone audio and/or typed text to animate a character's mouth with 12 viseme mouth shapes.

## Quick Start

1. Open `index.html` in your browser (Chrome or Edge recommended)
2. Load your character images (see below)
3. Click **Start**
4. Talk into your mic — the mouth moves in real-time

That's it.

## Your Images

You need **13 images total**: 1 base face + 12 mouth shapes.

### Base Face Image

- Your character's face with the **mouth area transparent** (or blank)
- PNG format with transparency works best
- Any resolution — the canvas auto-scales

### 12 Viseme Mouth Images

Name your files **exactly** like this:

| File | Viseme | What It Looks Like |
|------|--------|--------------------|
| `viseme0.png` | Neutral | Mouth closed — rest/silence |
| `viseme1.png` | Aa | Wide open — "father", "cat" |
| `viseme2.png` | D | Tongue on ridge — d, t, n |
| `viseme3.png` | Ee | Wide smile — "see", "bit" |
| `viseme4.png` | F | Lower lip under teeth — f, v |
| `viseme5.png` | L | Tongue tip up — l |
| `viseme6.png` | M | Lips pressed — m, b, p |
| `viseme7.png` | Oh | Rounded open — "boat", "saw" |
| `viseme8.png` | R | Slight pucker — r |
| `viseme9.png` | S | Teeth narrow — s, z, sh, ch |
| `viseme10.png` | Uh | Slightly open — "uh", schwa |
| `viseme11.png` | W-Oo | Pursed/rounded — w, "oo", "blue" |

The mouth images should be **just the mouth area**, not the full face. They get composited on top of the base face at the position you set.

## Loading Images

Two ways:

### File Picker
- **Base Face Image** — click "Choose File" under Character Setup, pick your base face PNG
- **Viseme Mouth Images** — click "Choose File" under Viseme Mouth Images, select all 12 viseme files at once (multi-select)

### Drag and Drop
- Drag your image files directly onto the canvas area
- Files named `viseme0.png` through `viseme11.png` auto-map to the right slots
- Other image files load as the base face

The status indicator shows `X/12 visemes loaded` so you know what's missing.

## Positioning the Mouth

After loading images, you need to align the mouth overlay on the base face:

- **Click on the canvas** to set the mouth center position
- **X Position slider** — move mouth left/right
- **Y Position slider** — move mouth up/down
- **Mouth Scale slider** — make the mouth overlay bigger/smaller

Default position is center-horizontal (0.5) and 70% down (0.7).

## Sync Modes

Pick a mode from the dropdown in the top-right:

### Hybrid (Audio + Text) — Default
Uses your microphone audio energy to detect **when** to move the mouth, and typed text to determine **which** mouth shape to show. Best of both worlds.

### Audio Only
Mouth shapes are driven purely by microphone volume levels:
- Loud = wide open (Aa)
- Medium = rounded (Oh, Uh)
- Quiet = subtle (Ee, M)
- Silent = closed (Neutral)

No text input needed. Good for when you're just talking freely.

### Text Only
Mouth shapes are driven by the text you type/paste in the text box. Each letter maps to a viseme. The animation plays through the viseme sequence on a timer. Good for pre-scripted content.

## Display Controls

- **Opacity** — fade the entire avatar in/out (0 to 1)
- **Scale** — resize the whole avatar (0.1x to 3x)

## Viseme Tester

The 12 buttons in the sidebar (Neutral, Aa, D, Ee, F, L, M, Oh, R, S, Uh, W-Oo) let you preview individual mouth shapes without audio. Click any button to see that viseme rendered on the canvas. Use this to verify your images look right.

## Using with OBS

1. Open the app in a browser
2. In OBS, add a **Browser Source** or use **Window Capture**
3. The canvas has a **transparent background** (checkered pattern is just the preview), so it composites cleanly over your scene
4. For Browser Source: point it at the `index.html` file path or serve it locally

## Text Input

Type or paste text into the text box at the bottom of the sidebar. The app converts text to viseme sequences in real-time using rule-based phoneme mapping:

- Digraphs like "th", "sh", "ch", "oo" are recognized
- Each letter maps to one of the 12 viseme shapes
- Spaces between words insert brief rest (mouth closed) pauses

## Running Tests

```bash
npm install
npm test
```

196 tests across 6 test suites covering all modules.

## Project Structure

```
index.html              — Main UI (single page, no build step)
css/styles.css          — Dark theme styles
js/audio-processor.js   — Mic capture via Web Audio API + AudioWorklet
js/audio-worklet-processor.js — AudioWorklet for low-latency audio analysis
js/text-processor.js    — Text-to-viseme conversion (rule-based)
js/sync-engine.js       — Hybrid sync engine (audio + text timing)
js/asset-manager.js     — Image loading, drag-drop, mouth calibration
js/renderer.js          — Canvas rendering at 60 FPS
js/app.js               — Main orchestrator, wires everything together
tests/                  — Jest test suites for each module
```

## Requirements

- Modern browser with Web Audio API support (Chrome, Edge, Firefox)
- Microphone access (for audio modes)
- No build step, no bundler, no framework — just open `index.html`
