# 寫實蜜蜂與花朵

直接以 Chrome 或 Edge 開啟 **bee_scene_standalone.html**。這是已內嵌 Three.js 和所有材質的單一離線檔案，不需要安裝套件或啟動伺服器。

下方可選擇六種花，使用「花朵特寫」環繞觀察，或使用「蜜蜂特寫」跟隨蜜蜂飛向選定花朵。「暫停」可停止行為動畫。左上「觀察設定」可展開時間、日照、飛行速度、行為、視角與路徑控制。

場景使用程序化 3D 幾何與 AI 生成的寫實材質；它是寫實風格的互動作品，並非實景攝影或嚴格的生物學研究模擬。

## 檔案

- `bee_scene.html`：可編輯的模組版來源；以本機 HTTP 伺服器預覽。
- `bee_scene_standalone.html`：可直接開啟、分享的離線版本。
- `assets/`：兩組原始 PNG 材質圖集、WebP 版本、內嵌材質模組與生成提示詞。
- `vendor/three/`：Three.js 0.160.0 和使用的附加模組，附 MIT 授權。
- `previews/`：實際瀏覽器渲染的蜜蜂與各花種檢查圖。
- `backups/`：各階段的 `bee_scene.html` 備份（`original` 修改前原始檔、`before-refinement`、`before-critic`）。
- `.buildtools/`：打包與驗證工具（esbuild 0.25.5 Windows 版、四視角擷取、評審循環與行為驗證腳本）。
- `.quality/`：評審流程說明、報告與各輪截圖紀錄。
- `.github/workflows/pages.yml`：發佈到 GitHub Pages 的工作流程。

## GitHub Pages

推送到預設分支後，`.github/workflows/pages.yml` 會把 `bee_scene.html`（作為首頁 `index.html`）、`bee_scene_standalone.html`、`vendor/` 與 `assets/texture-data.js` 發佈到 `https://malilion.github.io/bee_scene/`。第一次使用前需在 GitHub 的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**；免費帳號的私人儲存庫無法使用 Pages，需先改為公開。

修改來源或材質模組後，執行 `./build-scene.ps1` 重新建立離線 HTML。打包工具已置於 `.buildtools/`；建置本身不需連網。

## 主要視覺調整

蜜蜂縮小為較自然的相對比例，胸毛改為細密分枝絨毛，腹部補上短毛、褐色背板紋理與較霧面的幾丁質。採蜜和蜂巢活動時收翅，飛行時拍翅；一般採蜜不露出螫針。

六種花使用不同瓣形、葉形與花盤。波斯菊使用八枚舌狀花與羽狀細裂葉；兩種百合使用六枚花被片，分別呈現白色瓣緣及金色中線。花蕊不自發光，也不隨蜜量改變花色。降落位置會隨花頭的世界座標更新。

鏡頭加入微距景深，並在深度階段排除透明介面圓環、薄翅和粒子，避免它們遮擋景深。草地與遠方樹葉使用實例化幾何。

材質使用內建 imagegen 生成；詳細提示詞與圖集配置見 `assets/IMAGE_PROMPTS.md`。

## 本輪完善

百合改為更寬、向外反捲的花被片；花絲與花藥縮細並調整為自然褐色。紫錐菊的花盤改用較接近錐形的高度輪廓，小花密度、尺寸和位置加入細微差異。花朵特寫依實際網格及畫面比例取景，保留邊緣空間。

蜜蜂現在以花面坡度決定身體傾角，再分別求解六足關節。這使用花朵的近似連續支撐面，並非對每一粒花粉或小花做碰撞。飛行時收足，接近花朵時逐漸伸足；薄翅以低透明度的取樣殘影呈現快速拍動。微距追蹤會持續對準蜜蜂，降低快速飛行時離開畫面的情況。

`.buildtools/verify-scene.cjs` 使用目前環境的 Node.js、Playwright 及 Chrome 進行可重跑驗證：三組隨機場景、十八項花面站姿、合計九分鐘的模擬循環、追焦、暫停、花種切換及手機控制列。行為測試停用繪圖以快速推進時間；實際渲染畫面另存於 `previews/refinement/`，驗證報告為該資料夾內的 `verification.json`。
# 毒舌評審：四視角自動退件

執行 `./build-scene.ps1`，每次改版會自動截取俯視、蜂體特寫、低角度防穿模、線框四張 PNG，交給獨立的唯讀 Codex CLI 評審。**每張都須 ≥9/10 且無阻擋問題**；未達標會自動交回修正，再建置、截圖與重評。預設每次最多三輪，達上限仍維持退件、以非零退出碼結束；可用 `-MaxRounds 6` 調整。

可直接開啟 [.quality/report.html](.quality/report.html) 查看四張圖與評語。最新結果見 `.quality/latest.json`，完整圖檔、原始評語、執行紀錄與驗證結果保存在 `.quality/rounds/`。缺圖、舊版本、渲染失敗、評審未完成均不能通過。當原單檔被預覽鎖住時，當前輸出改存 `.quality/builds/`，實際路徑見 `.quality/build-artifact.json`。

需已登入的 Codex CLI、Node、Playwright、Chrome。規則適用本專案；其他前端需先接上對應的四視角擷取器。詳細角色與固定評分標準見 [.quality/WORKFLOW.md](.quality/WORKFLOW.md)。`-BundleOnly` 僅供內部建置，不代表已通過。自動檢查工具可執行 `.buildtools/verify-quality.cjs`。

