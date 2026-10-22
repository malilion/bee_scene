const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(require('node:path').join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'previews', 'refinement');

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--use-angle=swiftshader', '--enable-webgl']
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__testTime = 0;
    Object.defineProperty(performance, 'now', { value: () => window.__testTime });
    window.requestAnimationFrame = callback => { window.__frame = callback; return 1; };
    window.__step = () => { window.__testTime += 100; window.__frame?.(window.__testTime); };
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    const filename = path.resolve(root, decodeURIComponent(url.pathname.slice(1)));
    if (!filename.startsWith(root + path.sep)) return route.abort();
    try {
      let body = await fs.readFile(filename);
      if (filename.endsWith('bee_scene.html')) {
        // Exercise the actual simulation while omitting expensive GPU draws.
        body = body.toString().replace('    const clock = new THREE.Clock();',
          '    composer.render = () => {};\n    const clock = new THREE.Clock();');
      }
      await route.fulfill({ body, contentType: filename.endsWith('.js') ? 'text/javascript' : 'text/html' });
    } catch { await route.abort(); }
  });
  const worlds = [];
  try {
    for (let world = 0; world < 3; world++) {
      await page.goto('http://127.0.0.1:8765/bee_scene.html', { waitUntil: 'load', timeout: 60000 });
      const stance = await page.evaluate(() => {
        const result = [];
        for (let i = 0; i < 6; i++) {
          window.setDiagnosticView('flower_portrait', i);
          const d = window.getSceneDiagnostics();
          result.push({ flower: i, error: Math.max(...d.footContacts.map(f => Math.abs(f.clearance))), frame: d.framedFlower });
        }
        return result;
      });
      stance.forEach(row => {
        assert.ok(row.error < 0.01, 'Stance error ' + row.error);
        assert.ok(row.frame.min[0] >= -0.91 && row.frame.max[0] <= 0.91 && row.frame.min[1] >= -0.81 && row.frame.max[1] <= 0.81, 'Flower cropped');
      });
      await page.reload({ waitUntil: 'load', timeout: 60000 });
      const cycle = await page.evaluate(() => {
        const modes = new Set(), invalid = [];
        let maxHive = 0, maxStance = 0, maxScreenOffset = 0, flyingBlur = false, restingWings = false;
        for (let i = 0; i < 1800; i++) {
          window.__step(); const d = window.getSceneDiagnostics(); modes.add(d.mode);
          maxHive = Math.max(maxHive, d.hiveFilled);
          maxScreenOffset = Math.max(maxScreenOffset, Math.abs(d.beeScreenPosition[0]), Math.abs(d.beeScreenPosition[1]));
          if (d.position.some(v => !Number.isFinite(v)) || d.pollenLoad < 0 || d.pollenLoad > 3 ||
              d.flowers.some(f => f.nectar < 0 || f.nectar > 1)) invalid.push(i);
          if (d.mode.startsWith('FLYING') && d.wingBlurVisible === 6) flyingBlur = true;
          if (d.mode === 'FORAGING') {
            // Resting wings fold along the body (>57 degrees), distinct from
            // the open flight pose. Their exact artistic angle may change.
            restingWings ||= d.wingBlurVisible === 0 && Math.abs(d.wingAngles[0]) > 1.0;
            maxStance = Math.max(maxStance, ...d.footContacts.map(f => Math.abs(f.clearance)));
          }
        }
        return { modes: [...modes], invalid, maxHive, maxStance, maxScreenOffset, flyingBlur, restingWings };
      });
      assert.deepEqual(cycle.invalid, []);
      assert.ok(cycle.maxScreenOffset < 0.001, 'Macro camera lost bee');
      for (const mode of ['FORAGING', 'FLYING_TO_FLOWER', 'FLYING_TO_HIVE', 'WAGGLE_DANCE', 'MORNING_SORTIE']) assert.ok(cycle.modes.includes(mode), mode);
      assert.ok(cycle.maxHive >= 3 && cycle.flyingBlur && cycle.restingWings);
      assert.ok(cycle.maxStance < 0.015, `Walking clearance ${cycle.maxStance}`);
      worlds.push({ stance, cycle });
    }
    await page.locator('#pause-scene').dispatchEvent('click');
    const position = await page.evaluate(() => window.getSceneDiagnostics().position);
    await page.evaluate(() => { for (let i = 0; i < 10; i++) window.__step(); });
    assert.deepEqual(await page.evaluate(() => window.getSceneDiagnostics().position), position);
    await page.locator('#pause-scene').dispatchEvent('click');
    await page.locator('#flower-select').selectOption('4');
    await page.locator('#observe-bee').dispatchEvent('click');
    assert.equal(await page.evaluate(() => window.getSceneDiagnostics().targetFlower), 4);
    await page.locator('#observe-flower').dispatchEvent('click');
    assert.equal(await page.evaluate(() => window.getSceneDiagnostics().camera), 'free');
    await page.setViewportSize({ width: 390, height: 844 });
    // Chromium dispatches resize after the viewport command has returned.
    // Wait for the renderer to consume it before measuring overflow.
    await page.waitForFunction(() => document.querySelector('canvas').clientWidth === innerWidth, null, {polling:50});
    const layout = await page.locator('#observation-tools').evaluate(el => {
      const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(layout.left >= 0 && layout.right <= 390 && layout.bottom <= 844 && !layout.overflow);
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ passed: true, drawingDisabled: true, simulatedSeconds: 540, worlds, layout, errors }, null, 2));
    console.log('PASS: 3 randomized worlds, 18 flower stances, 540 seconds of behavior, pause, selection, mobile layout.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
