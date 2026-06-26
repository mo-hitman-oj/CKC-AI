# CKC Jewellers · AI Concierge

A premium, single-page AI-concierge demonstration for a luxury jewellery
showroom. A programmatically faceted **brilliant-cut diamond** entity reacts in
real time to pre-recorded voice-overs in three languages, set inside a
two-panel concierge interface.

> **Demonstration only** — there is no speech recognition. Selecting a language
> and pressing **Tap to speak** plays a local audio file; the diamond reacts to
> the real audio spectrum via the Web Audio API, and on-screen captions advance
> in sync with the voice.

## Run it

```bash
node server.js          # → http://localhost:5173
```

(Any static server works, e.g. `python3 -m http.server 5173`.) Open the URL,
pick a language top-right, and press **Tap to speak**. A click is required first
so the browser may start audio (standard autoplay policy).

## Layout

- **Left panel** — CKC logo, the live 3D diamond entity (golden particles, glow,
  audio-reactive), a synced caption line, and the **Tap to speak** / mic controls.
- **Right panel** — "Your AI Jewellery Concierge" with a 6-category grid
  (Diamonds, Necklaces, Rings, Earrings, Bangles & Bracelets, Pendants) and a row
  of quick actions (Diamond Guide, Compare, Collections, Offers, Ask Anything).

## How it works

| Concern | Implementation |
| --- | --- |
| Entity | Custom faceted brilliant-cut geometry, self-illuminated crystal shader (facet shading + fresnel rim), bounded brightness — renders reliably on any GPU |
| Internal caustics | Fresnel glow core + drifting inner sparks + a soft "heart" point |
| Atmosphere | 1,300 golden particles + 420 white sparkles (GPU shader drift / twinkle) |
| Glow | `EffectComposer` + `UnrealBloomPass`, tuned so only highlights bloom |
| Camera | Perspective camera fitted to the left panel, gentle `OrbitControls` auto-orbit |
| Audio reaction | Web Audio `AnalyserNode` → RMS loudness + bass/mid/treble bands (fast attack / slow release so it never jitters) |
| Captions | `transcripts.js` lines revealed by playback progress, weighted by line length |

## Content you can edit

- **Voice-overs** — `assets/audio/{english,hindi,kannada}.mp3`
- **Transcripts / captions** — `transcripts.js` (lines per language; source in `subtitle.md`)
- **Category images** — `assets/img/{diamond,necklace,ring,earrings,bangles,pendant}.png`
  (1024² recommended; cards fall back to a placeholder glyph if an image is missing)

## Files

```
index.html            two-panel concierge layout + styling
main.js               Three.js diamond + audio-reactive engine + UI wiring
transcripts.js        caption lines per language
server.js             minimal static file server
assets/audio/         voice-overs
assets/img/           category product images
versions/             saved benchmarks (see below)
```

## Benchmark / revert

The previous **full-screen centred-diamond** version is preserved at
`versions/v1-centered-diamond/` (`index.html` + `main.js`). To revert:

```bash
cp versions/v1-centered-diamond/index.html versions/v1-centered-diamond/main.js .
```

(The current two-panel files are the live `index.html` / `main.js`. Snapshot them
first if you want to keep this version before reverting.)

## Dev flags (query string, no-ops on normal load)

`?nobloom` · `?noparticles` · `?nocore` · `?loud` (pins the reactive level high
to preview the speaking state without audio).

## Tech

Three.js 0.160 (CDN import map) · OrbitControls · EffectComposer ·
UnrealBloomPass · Web Audio API. No React, no build step, no frameworks.
