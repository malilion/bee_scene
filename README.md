# Realistic Bee & Flowers

**English** · [繁體中文](README.zh-TW.md)

**Live demo**: <https://malilion.github.io/bee_scene/>

![Flower meadow, top view](docs/screenshots/top_down.jpg)

## Overview

An interactive 3D scene that runs in the browser: a western honeybee (*Apis mellifera*) forages among six kinds of flowers in a meadow, flies back to the hive, performs the waggle dance and stores nectar in the comb. Everything is modeled procedurally with Three.js (WebGL) and textured with AI-generated realistic material atlases, with a day-light cycle, macro depth of field and several observation cameras.

It is a realistic-style interactive piece, not photography and not a rigorous biological simulation.

## Quick start

**Open directly**: open **`index.html`** in Chrome or Edge. It is a single offline file with Three.js and all textures embedded. No install, network or server needed.

**With a static server**: `bee_scene.html` is the editable module source. It loads `vendor/` and `assets/` through an import map, and browsers block module loading from `file://`, so serve the folder over HTTP:

```bash
# from the project root, either one
python -m http.server 8765
npx serve -l 8765 .
```

Then open <http://localhost:8765/bee_scene.html> (or `/index.html`).

**Online**: pushes to `main` (the default branch) are published by GitHub Actions to <https://malilion.github.io/bee_scene/> (see [GitHub Pages](#github-pages) for setup).

## Screenshots

| Bee macro close-up | Low angle, leg contact |
|---|---|
| ![Macro close-up](docs/screenshots/macro_closeup.jpg) | ![Low angle](docs/screenshots/low_angle_anti_clip.jpg) |
| **Wireframe** | **Top view** |
| ![Wireframe](docs/screenshots/wireframe.jpg) | ![Top view](docs/screenshots/top_down.jpg) |

These are real browser renders (1280×960) captured by the four-view review workflow.

## Controls

**Bottom toolbar**

| Control | What it does |
|---|---|
| Flower picker (觀察花種) | Choose one of six flowers: sunflower, purple coneflower, Stargazer lily, oxeye daisy, golden-rayed lily, pink cosmos |
| Flower close-up (花朵特寫) | Switch to the orbit camera, frame the flower to fit the screen and enable depth of field |
| Bee close-up (蜜蜂特寫) | Switch to the macro camera and send the bee to the selected flower, keeping it in focus |
| Pause / Resume (暫停／繼續) | Stop or resume all behavior animation |

**"☷ 觀察設定" (Observation settings) panel, top left**

| Section | Controls |
|---|---|
| Daylight timeline | Drag 06:00–18:00 to change sun direction, light color and exposure; auto time; soft bloom |
| Behavior stages | Jump to Morning sortie / Foraging / Waggle dance; auto cycle |
| Status | Pollen basket load (0–3), stored honey cells (0–12), harvest count |
| Camera | Free orbit, Macro, Chase cam, Bee POV (first person) |
| Speed & paths | Flight and action speed 0.2×–2.5×; show the 3D flight / waggle-dance path |

**Mouse**

- Free orbit mode: left-drag to rotate, right-drag to pan, wheel to zoom (down to the florets).
- Hover a flower to see its name and remaining nectar; **click a flower** to send the bee there.
- **Click the hive** to send the bee home to dance.

## How it plays

It is an observation sim with no win or lose state. The bee runs its own daily loop, and you can step in at any time:

1. **Morning sortie**: the bee leaves the hive and patrols the flower patch along a smooth 3D curve.
2. **Foraging**: it picks a flower with plenty of nectar, lands and stands on the flower head with all six legs. Each flower's nectar drains while it feeds and slowly refills afterwards, so the bee rotates between flowers.
3. **Return**: once the pollen baskets hold 3 loads it flies back to the hive.
4. **Waggle dance**: it dances on the comb to signal the flower's location while filling honey cells one by one.
5. **Harvest**: when all 12 cells are full, a harvest fires, the comb empties, the harvest count goes up and the bee sets out again.

Things to try: click flowers to choose where the bee goes, turn off auto cycle and advance each stage yourself, drag the timeline from dawn to dusk, or ride along in first person.

## Rendering

- **Engine**: Three.js 0.160.0 (WebGL) loaded as ES modules; the offline build is bundled into one HTML file with esbuild.
- **Materials**: PBR `MeshStandardMaterial` / `MeshPhysicalMaterial`, with sheen for thorax hair and petals, clearcoat for abdominal chitin, and transmission for wax and honey. Base colors come from two AI-generated atlases (petals; bee body and leaves), embedded as WebP data URIs in `assets/texture-data.js`.
- **Lighting**: procedural PMREM environment map, hemisphere light, directional sun and a fill light; PCF soft shadows; ACES Filmic tone mapping, sRGB output and exponential fog. Time of day interpolates light color, direction and exposure between keyframes.
- **Post-processing**: `EffectComposer` → `RenderPass` → `UnrealBloomPass` (toggleable) → `BokehPass` (macro depth of field) → `OutputPass`. The depth pass skips transparent objects (thin wings, UI rings, particles) so they do not block focus.
- **Geometry**: flowers, bee and hive are all procedural. Florets follow a 137.5° golden-angle (Fermat spiral) layout; 11,500 grass blades, 18,000 distant leaves and the florets use `InstancedMesh`.
- **Animation**: flight paths are Catmull-Rom curves; on landing the body tilts to the flower's surface slope and each of the six legs is solved separately; legs tuck in during flight and extend on approach; wing beats are shown as low-opacity sampled motion blur.
- **Diagnostic views**: add `?view=top_down|macro_closeup|low_angle_anti_clip|wireframe&flower=0-5` to the URL to jump to a fixed inspection view, used for automated capture and review.

## Project structure

```
.
├── index.html                  # Single-file offline build (open directly)
├── bee_scene.html              # Editable module source (needs an HTTP server)
├── build-scene.ps1             # Build + four-view review loop; -BundleOnly just bundles
├── download-three.ps1          # Downloads the Three.js add-ons
├── AGENTS.md                   # Visual acceptance rules for AI agents
├── assets/                     # Texture atlases (PNG, WebP), texture-data.js, generation prompts
├── vendor/three/               # Three.js 0.160.0 and the add-ons used (MIT)
├── docs/screenshots/           # README screenshots
├── backups/                    # Earlier snapshots of bee_scene.html
├── .buildtools/                # esbuild, capture / review / behavior-check scripts
├── .quality/                   # Review workflow (WORKFLOW.md), report, per-round captures and scores
└── .github/workflows/pages.yml # GitHub Pages deploy
```

**Development**: after editing `bee_scene.html` or `assets/`, run `./build-scene.ps1` to regenerate `index.html`. It captures top-down, macro, low-angle and wireframe views and sends them to an independent reviewer; **every view must score ≥ 9/10** to pass, and failures are repaired and re-reviewed automatically (3 rounds by default, change with `-MaxRounds 6`). It needs Node, Playwright, Chrome and a signed-in Codex CLI; see [.quality/WORKFLOW.md](.quality/WORKFLOW.md), with the report at [.quality/report.html](.quality/report.html). Visual acceptance is still pending. See `.quality/latest.json` and the report for current per-view scores and blockers; all round evidence is retained under `.quality/rounds/`.

Behavior checks: `.buildtools/verify-scene.cjs` runs three randomized worlds, eighteen flower stances and a nine-minute simulated loop, writing results to `previews/refinement/`.

**macOS / Linux**: run `node .buildtools/quality-loop.cjs --max-rounds=3` for the same build, capture and independent review loop. Set `ESBUILD_BINARY` to the esbuild executable, `NODE_PATH` to the packages directory containing Playwright, and `CHROME_PATH` to Chrome (on macOS, `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`). Run `node .buildtools/verify-scene.cjs` for behavior checks. `node .buildtools/bundle-scene.cjs` only bundles the offline file; it does not grant visual approval.

## GitHub Pages

`.github/workflows/pages.yml` publishes `index.html`, `bee_scene.html`, `vendor/` and `assets/texture-data.js` on every push to `main` (the default branch). Before the first deploy:

1. GitHub Pages is not available for private repos on a free account. Make the repo public under **Settings → General → Change visibility** (or use GitHub Pro).
2. Under **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**, then re-run the workflow from the Actions tab.

## License and sources

Three.js is MIT-licensed (see `vendor/three/LICENSE`). The texture atlases are AI-generated realistic references, not biological scans; the prompts are in [assets/IMAGE_PROMPTS.md](assets/IMAGE_PROMPTS.md).
