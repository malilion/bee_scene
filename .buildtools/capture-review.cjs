const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const views = ['top_down', 'macro_closeup', 'low_angle_anti_clip', 'wireframe'];
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
async function inputs() {
  const files = ['bee_scene.html', 'build-scene.ps1'];
  async function walk(dir) {
    for (const e of (await fs.readdir(path.join(root, dir), { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name))) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) await walk(p); else files.push(p);
    }
  }
  await walk('assets'); await walk('vendor');
  const result = {};
  for (const file of files) result[file] = hash(await fs.readFile(path.join(root, file)));
  return result;
}
async function capture() {
  let chromium;
  try { ({chromium} = require('playwright')); }
  catch { ({chromium} = require(process.env.PLAYWRIGHT_MODULE || require('node:path').join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
  const roundId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
  const dir = path.join(root, '.quality', 'rounds', roundId);
  await fs.mkdir(dir, {recursive:true});
  // Invalidate approval before capture, including on a renderer failure.
  await fs.writeFile(path.join(root,'.quality','latest.json'), JSON.stringify({roundId, status:'capturing'},null,2));
  await require('./quality-report.cjs').writeStatus('正在產生四視角',roundId);
  const artifact = JSON.parse(await fs.readFile(path.join(root,'.quality','build-artifact.json'),'utf8')).artifact;
  if(!path.resolve(artifact).startsWith(root+path.sep)) throw new Error('Build artifact outside project');
  const artifactSha256 = hash(await fs.readFile(artifact));
  const sourceHashes = await inputs();
  const browser = await chromium.launch({headless:true,
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--use-angle=swiftshader','--enable-webgl']});
  const errors = [], images = [];
  try {
    const page = await browser.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1});
    page.on('pageerror', e=>errors.push(e.message));
    await page.addInitScript(() => {
      let seed=7331;
      Math.random=()=> { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
      window.requestAnimationFrame=()=>0;
    });
    await page.goto(pathToFileURL(artifact).href, {waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForFunction(()=>{const ready=window.getSceneDiagnostics?.().materialsReady;return ready===true||ready==='true';}, null, {polling:100,timeout:90000});
    for (const view of views) {
      await page.evaluate(v=>window.setDiagnosticView(v,0),view);
      const diagnostics = await page.evaluate(()=>window.getSceneDiagnostics());
      if(diagnostics.mode!=='FORAGING'||diagnostics.camera!=='diagnostic'||!(diagnostics.materialsReady===true||diagnostics.materialsReady==='true')) throw new Error('Diagnostic pose/materials not ready: '+view);
      const file = path.join(dir,view+'.png');
      await page.screenshot({path:file,timeout:90000});
      images.push({view,path:file,sha256:hash(await fs.readFile(file)),diagnostics});
      console.log('Captured '+view);
    }
  } finally { await browser.close(); }
  if(new Set(images.map(i=>i.sha256)).size!==4) throw new Error('Duplicate diagnostic screenshots');
  if (errors.length) throw new Error('Renderer errors: '+errors.join('; '));
  if (hash(await fs.readFile(artifact))!==artifactSha256 || JSON.stringify(await inputs())!==JSON.stringify(sourceHashes)) throw new Error('Inputs changed during capture');
  const manifest={roundId,createdAt:new Date().toISOString(),artifact,artifactSha256,sourceHashes,viewport:{width:1280,height:960},seed:7331,flowerIndex:0,pose:'FORAGING',images,errors};
  await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
  await fs.writeFile(path.join(root,'.quality','latest.json'),JSON.stringify({roundId,status:'awaiting_independent_review',manifest:path.join(dir,'manifest.json')},null,2));
  return {dir,manifest};
}
async function gate(dir, {publish=true}={}) {
  try {
  const m=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
  const r=JSON.parse(await fs.readFile(path.join(dir,'review.json'),'utf8'));
  const issues=[];
  if(!Array.isArray(m.errors)||m.errors.length) issues.push('Renderer errors or missing renderer assessment');
  if(m.pose!=='FORAGING'||m.viewport?.width!==1280||m.viewport?.height!==960) issues.push('Capture configuration mismatch');
  if(r.roundId!==m.roundId || r.artifactSha256!==m.artifactSha256) issues.push('Review belongs to another render');
  if(hash(await fs.readFile(m.artifact))!==m.artifactSha256 || JSON.stringify(await inputs())!==JSON.stringify(m.sourceHashes)) issues.push('Scene changed after review');
  if(r.reviewer?.role!=='independent-adversarial-critic' || !r.reviewer?.runId) issues.push('Independent reviewer provenance missing');
  if(!Array.isArray(r.views)||r.views.length!==views.length) issues.push('Four reviews required');
  const scores=[];
  for(const view of views) {
    const im=m.images.filter(i=>i.view===view), rv=(r.views||[]).filter(i=>i.view===view);
    if(im.length!==1||rv.length!==1) {issues.push('Missing/duplicate '+view); continue;}
    const png=await fs.readFile(im[0].path);
    if(png.length<24||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.readUInt32BE(16)!==1280||png.readUInt32BE(20)!==960) issues.push('Invalid screenshot PNG: '+view);
    if(hash(png)!==im[0].sha256 || rv[0].imageSha256!==im[0].sha256) issues.push('Image changed: '+view);
    if(im[0].diagnostics?.mode!=='FORAGING'||im[0].diagnostics?.camera!=='diagnostic'||![true,'true'].includes(im[0].diagnostics?.materialsReady)) issues.push('Invalid capture diagnostics: '+view);
    if(typeof rv[0].score!=='number'||!Number.isFinite(rv[0].score)||rv[0].score<9||rv[0].score>10) issues.push('Below 9 or invalid score: '+view);
    if(!rv[0].evidence?.trim()) issues.push('Visual evidence missing: '+view);
    scores.push(rv[0].score);
  }
  if(!Array.isArray(r.blockers)||r.blockers.length) issues.push('Unresolved blockers or missing blocker assessment');
  const receipt=JSON.parse(await fs.readFile(path.join(dir,'critic-receipt.json'),'utf8'));
  const rawBytes=await fs.readFile(path.join(dir,'critic-output.json'));
  const raw=JSON.parse(rawBytes.toString());
  const eventBytes=await fs.readFile(path.join(dir,'critic-events.jsonl'));
  const events=eventBytes.toString().split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
  if(receipt.roundId!==m.roundId||receipt.runId!==r.reviewer?.runId||receipt.outputSha256!==hash(rawBytes)||receipt.eventsSha256!==hash(eventBytes)||!events.some(e=>e.type==='thread.started'&&e.thread_id===receipt.runId)||!events.some(e=>e.type==='turn.completed')) issues.push('Independent CLI execution receipt invalid');
  if(JSON.stringify(raw.blockers)!==JSON.stringify(r.blockers)||JSON.stringify(raw.repairs)!==JSON.stringify(r.repairs)||JSON.stringify(raw.views)!==JSON.stringify(r.views.map(({imageSha256,...v})=>v))) issues.push('Scores differ from independent raw output');
  const status=issues.length?'rejected':'approved';
  const result={roundId:m.roundId,status,mean:scores.length===4?scores.reduce((a,b)=>a+b,0)/4:null,issues,review:path.join(dir,'review.json'),manifest:path.join(dir,'manifest.json')};
  await fs.writeFile(path.join(dir,'gate.json'),JSON.stringify(result,null,2));
  if(publish) await fs.writeFile(path.join(root,'.quality','latest.json'),JSON.stringify(result,null,2));
  if(publish) await require('./quality-report.cjs').writeReport(result);
  return result;
  } catch(error) {
    if(publish) {
      await fs.writeFile(path.join(root,'.quality','latest.json'),JSON.stringify({status:'error',manifest:path.join(dir,'manifest.json'),error:error.message},null,2));
      await require('./quality-report.cjs').writeStatus('驗證失敗',error.message);
    }
    throw error;
  }
}
module.exports={root,views,hash,inputs,capture,gate};
if(require.main===module) (async()=>{
  if(process.argv[2]==='gate') {const r=await gate(path.resolve(process.argv[3]));console.log(JSON.stringify(r,null,2));process.exitCode=r.status==='approved'?0:1;}
  else console.log(JSON.stringify(await capture(),null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
