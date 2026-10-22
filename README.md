# 寫實蜜蜂與花朵 · Realistic Bee & Flowers

[中文](#中文) · [English](#english)

![花朵俯視 / Flower meadow, top view](docs/screenshots/top_down.jpg)

---

## 中文

### 簡介

這是一個在瀏覽器執行的互動式 3D 場景：一隻西方蜜蜂（*Apis mellifera*）在草地上的六種花之間採蜜，回到蜂巢跳八字舞並把花蜜存進蜂巢格子。場景使用 Three.js（WebGL）以程序化幾何建模，搭配 AI 生成的寫實材質圖集，並加入日照變化、微距景深與多種觀察鏡頭。

它是寫實風格的互動作品，不是實景攝影，也不是嚴格的生物學模擬。

### 快速開始

**直接開啟**：用 Chrome 或 Edge 開啟 **`index.html`**。這是單一離線檔，已內嵌 Three.js 與所有材質，不需要安裝套件、連網或架伺服器。

**用靜態伺服器**：`bee_scene.html` 是可編輯的模組版來源，它透過 import map 載入 `vendor/` 與 `assets/`，瀏覽器不允許從 `file://` 載入模組，所以需要本機 HTTP 伺服器：

```bash
# 在專案根目錄執行，任選一種
python -m http.server 8765
npx serve -l 8765 .
```

然後開啟 <http://localhost:8765/bee_scene.html>（或 `/index.html`）。

**線上版**：推送到預設分支後，GitHub Actions 會發佈到 <https://malilion.github.io/bee_scene/>（設定方式見 [GitHub Pages](#github-pages)）。

### 截圖展示

| 蜂體微距 | 低角度足部支撐 |
|---|---|
| ![蜂體微距](docs/screenshots/macro_closeup.jpg) | ![低角度](docs/screenshots/low_angle_anti_clip.jpg) |
| **線框檢視** | **花朵俯視** |
| ![線框](docs/screenshots/wireframe.jpg) | ![俯視](docs/screenshots/top_down.jpg) |

以上為四視角評審流程實際擷取的瀏覽器渲染畫面（1280×960）。

### 操作方式

**畫面下方工具列**

| 控制項 | 作用 |
|---|---|
| 觀察花種 | 選擇六種花之一：向日葵、紫錐菊、觀星者百合、法國濱菊、山百合、粉紅波斯菊 |
| 花朵特寫 | 切到自由環繞鏡頭，依花朵大小與畫面比例取景並開啟景深 |
| 蜜蜂特寫 | 切到微距鏡頭，讓蜜蜂飛向選定的花並持續追焦 |
| 暫停／繼續 | 停止或恢復所有行為動畫 |

**左上「☷ 觀察設定」面板**

| 區塊 | 控制項 |
|---|---|
| 日照時間軸 | 拖曳 06:00–18:00 改變太陽方向、光色與曝光；「自動時間流逝」；「柔和高光」（Bloom） |
| 日常行為階段 | 手動切換「晨間出擊／採集花蜜／八字舞」；「自動循環」 |
| 狀態 | 花粉籃負載（0–3）、蜂巢存蜜格（0–12）、已豐收輪數 |
| 鏡頭視角 | 自由環繞、微距觀察、追尾跟隨、第一人稱（蜜蜂視角） |
| 速度與軌跡 | 飛行與動作速度 0.2×–2.5×；顯示 3D 飛行／八字舞軌跡 |

**滑鼠**

- 自由環繞模式：左鍵拖曳旋轉、右鍵拖曳平移、滾輪縮放（可拉近到花蕊旁）。
- 滑鼠移到花朵上會顯示花名與剩餘花蜜；**點擊花朵**讓蜜蜂立刻飛去採蜜。
- **點擊蜂巢**讓蜜蜂立刻返巢跳八字舞。

### 玩法

這是一個觀察型模擬，沒有輸贏，蜜蜂會自己完成一整天的循環，你可以隨時介入：

1. **晨間出擊**：蜜蜂從蜂巢起飛，沿平滑的 3D 曲線巡航整片花叢。
2. **採集花蜜**：挑選花蜜較多的花降落，六足站在花盤上採集。每朵花的花蜜會被採少，離開後再慢慢恢復，所以蜜蜂會輪流拜訪不同的花。
3. **返巢**：花粉籃裝滿 3 份後飛回蜂巢。
4. **八字舞**：在巢脾表面跳搖擺舞傳遞花源位置，同時把花蜜一格一格存進蜂巢。
5. **豐收**：12 格存滿時觸發一次豐收、清空蜂巢，豐收輪數加一，然後再次出擊。

可以玩的方式：點擊指定要拜訪的花、關掉「自動循環」手動推進每個階段、拖動時間軸看清晨到黃昏的光線、或切到第一人稱跟著蜜蜂飛。

### 渲染技術

- **引擎**：Three.js 0.160.0（WebGL），以 ES 模組載入；離線版用 esbuild 打包成單一 HTML。
- **材質**：PBR `MeshStandardMaterial`／`MeshPhysicalMaterial`，胸毛與花瓣使用 sheen 絨面光澤，腹部幾丁質用 clearcoat，蜂蠟與蜂蜜使用 transmission 透光。底色來自兩張 AI 生成的材質圖集（花瓣、蜂體與葉片），以 WebP data URI 內嵌於 `assets/texture-data.js`。
- **光照**：程序化 PMREM 環境反射、半球光、太陽平行光與補光；PCF 柔和陰影；ACES Filmic 色調映射、sRGB 輸出、指數霧。日照時間以關鍵影格插值光色、方向與曝光。
- **後製**：`EffectComposer` → `RenderPass` → `UnrealBloomPass`（可開關）→ `BokehPass`（微距景深）→ `OutputPass`。景深的深度階段會排除透明物件（薄翅、介面圓環、粒子），避免它們遮住對焦。
- **幾何**：花、蜂、蜂巢全為程序化建模。花盤小花以 137.5° 黃金角（費馬螺線）排列；草地 11,500 片、遠景樹葉 18,000 片、花盤小花都使用 `InstancedMesh`。
- **動畫**：飛行路徑使用 Catmull-Rom 曲線；降落時以花面坡度決定身體傾角，再分別求解六足關節；飛行時收足、接近花朵時伸足；薄翅以低透明度取樣殘影呈現快速拍動。
- **診斷視角**：網址加上 `?view=top_down|macro_closeup|low_angle_anti_clip|wireframe&flower=0-5` 可直接切到固定檢驗視角，供自動截圖與評審使用。

### 專案結構

```
.
├── index.html                  # 單一離線版（建置輸出，可直接開啟）
├── bee_scene.html              # 可編輯的模組版來源（需 HTTP 伺服器）
├── build-scene.ps1             # 建置＋四視角評審循環；-BundleOnly 只打包
├── download-three.ps1          # 下載 Three.js 附加模組
├── AGENTS.md                   # 給 AI 代理的視覺驗收規則
├── assets/                     # 材質圖集（PNG 原檔、WebP）、texture-data.js、生成提示詞
├── vendor/three/               # Three.js 0.160.0 與使用的附加模組（MIT）
├── docs/screenshots/           # README 截圖
├── backups/                    # bee_scene.html 各階段備份
├── .buildtools/                # esbuild、截圖／評審／行為驗證腳本
├── .quality/                   # 評審流程（WORKFLOW.md）、報告、各輪截圖與評分
└── .github/workflows/pages.yml # GitHub Pages 發佈
```

**開發流程**：修改 `bee_scene.html` 或 `assets/` 後，執行 `./build-scene.ps1` 重新產生 `index.html`。它會擷取俯視、蜂體特寫、低角度、線框四張圖交給獨立評審，**每張都須 ≥ 9/10** 才算通過，未通過會自動修正並重評（預設最多 3 輪，`-MaxRounds 6` 可調整）。需要 Node、Playwright、Chrome 與已登入的 Codex CLI；詳見 [.quality/WORKFLOW.md](.quality/WORKFLOW.md)，報告在 [.quality/report.html](.quality/report.html)。目前最新一輪評審為**未通過**（平均 6.125）。

行為驗證：`.buildtools/verify-scene.cjs` 會跑三組隨機場景、十八項花面站姿與九分鐘模擬循環，結果輸出到 `previews/refinement/`。

### GitHub Pages

`.github/workflows/pages.yml` 會在推送到預設分支時發佈 `index.html`、`bee_scene.html`、`vendor/` 與 `assets/texture-data.js`。第一次使用前：

1. 免費帳號的私人儲存庫不能使用 Pages，需先在 **Settings → General → Change visibility** 改為公開（或使用 GitHub Pro）。
2. **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**，再到 Actions 重新執行工作流程。

### 授權與來源

Three.js 以 MIT 授權發佈（見 `vendor/three/LICENSE`）。材質圖集為 AI 生成的寫實參考圖，不是實際生物掃描；生成提示詞見 [assets/IMAGE_PROMPTS.md](assets/IMAGE_PROMPTS.md)。

---

## English

### Overview

An interactive 3D scene that runs in the browser: a western honeybee (*Apis mellifera*) forages among six kinds of flowers in a meadow, flies back to the hive, performs the waggle dance and stores nectar in the comb. Everything is modeled procedurally with Three.js (WebGL) and textured with AI-generated realistic material atlases, with a day-light cycle, macro depth of field and several observation cameras.

It is a realistic-style interactive piece, not photography and not a rigorous biological simulation.

### Quick start

**Open directly**: open **`index.html`** in Chrome or Edge. It is a single offline file with Three.js and all textures embedded. No install, network or server needed.

**With a static server**: `bee_scene.html` is the editable module source. It loads `vendor/` and `assets/` through an import map, and browsers block module loading from `file://`, so serve the folder over HTTP:

```bash
# from the project root, either one
python -m http.server 8765
npx serve -l 8765 .
```

Then open <http://localhost:8765/bee_scene.html> (or `/index.html`).

**Online**: pushes to the default branch are published by GitHub Actions to <https://malilion.github.io/bee_scene/> (see [GitHub Pages](#github-pages-1) for setup).

### Screenshots

| Bee macro close-up | Low angle, leg contact |
|---|---|
| ![Macro close-up](docs/screenshots/macro_closeup.jpg) | ![Low angle](docs/screenshots/low_angle_anti_clip.jpg) |
| **Wireframe** | **Top view** |
| ![Wireframe](docs/screenshots/wireframe.jpg) | ![Top view](docs/screenshots/top_down.jpg) |

These are real browser renders (1280×960) captured by the four-view review workflow.

### Controls

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

### How it plays

It is an observation sim with no win or lose state. The bee runs its own daily loop, and you can step in at any time:

1. **Morning sortie**: the bee leaves the hive and patrols the flower patch along a smooth 3D curve.
2. **Foraging**: it picks a flower with plenty of nectar, lands and stands on the flower head with all six legs. Each flower's nectar drains while it feeds and slowly refills afterwards, so the bee rotates between flowers.
3. **Return**: once the pollen baskets hold 3 loads it flies back to the hive.
4. **Waggle dance**: it dances on the comb to signal the flower's location while filling honey cells one by one.
5. **Harvest**: when all 12 cells are full, a harvest fires, the comb empties, the harvest count goes up and the bee sets out again.

Things to try: click flowers to choose where the bee goes, turn off auto cycle and advance each stage yourself, drag the timeline from dawn to dusk, or ride along in first person.

### Rendering

- **Engine**: Three.js 0.160.0 (WebGL) loaded as ES modules; the offline build is bundled into one HTML file with esbuild.
- **Materials**: PBR `MeshStandardMaterial` / `MeshPhysicalMaterial`, with sheen for thorax hair and petals, clearcoat for abdominal chitin, and transmission for wax and honey. Base colors come from two AI-generated atlases (petals; bee body and leaves), embedded as WebP data URIs in `assets/texture-data.js`.
- **Lighting**: procedural PMREM environment map, hemisphere light, directional sun and a fill light; PCF soft shadows; ACES Filmic tone mapping, sRGB output and exponential fog. Time of day interpolates light color, direction and exposure between keyframes.
- **Post-processing**: `EffectComposer` → `RenderPass` → `UnrealBloomPass` (toggleable) → `BokehPass` (macro depth of field) → `OutputPass`. The depth pass skips transparent objects (thin wings, UI rings, particles) so they do not block focus.
- **Geometry**: flowers, bee and hive are all procedural. Florets follow a 137.5° golden-angle (Fermat spiral) layout; 11,500 grass blades, 18,000 distant leaves and the florets use `InstancedMesh`.
- **Animation**: flight paths are Catmull-Rom curves; on landing the body tilts to the flower's surface slope and each of the six legs is solved separately; legs tuck in during flight and extend on approach; wing beats are shown as low-opacity sampled motion blur.
- **Diagnostic views**: add `?view=top_down|macro_closeup|low_angle_anti_clip|wireframe&flower=0-5` to the URL to jump to a fixed inspection view, used for automated capture and review.

### Project structure

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

**Development**: after editing `bee_scene.html` or `assets/`, run `./build-scene.ps1` to regenerate `index.html`. It captures top-down, macro, low-angle and wireframe views and sends them to an independent reviewer; **every view must score ≥ 9/10** to pass, and failures are repaired and re-reviewed automatically (3 rounds by default, change with `-MaxRounds 6`). It needs Node, Playwright, Chrome and a signed-in Codex CLI; see [.quality/WORKFLOW.md](.quality/WORKFLOW.md), with the report at [.quality/report.html](.quality/report.html). The latest review round was **rejected** (mean 6.125).

Behavior checks: `.buildtools/verify-scene.cjs` runs three randomized worlds, eighteen flower stances and a nine-minute simulated loop, writing results to `previews/refinement/`.

### GitHub Pages

`.github/workflows/pages.yml` publishes `index.html`, `bee_scene.html`, `vendor/` and `assets/texture-data.js` on every push to the default branch. Before the first deploy:

1. GitHub Pages is not available for private repos on a free account. Make the repo public under **Settings → General → Change visibility** (or use GitHub Pro).
2. Under **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**, then re-run the workflow from the Actions tab.

### License and sources

Three.js is MIT-licensed (see `vendor/three/LICENSE`). The texture atlases are AI-generated realistic references, not biological scans; the prompts are in [assets/IMAGE_PROMPTS.md](assets/IMAGE_PROMPTS.md).
