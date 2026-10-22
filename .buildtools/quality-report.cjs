const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function writeReport(result) {
  const manifest=JSON.parse(await fs.readFile(result.manifest,'utf8'));
  const review=JSON.parse(await fs.readFile(result.review,'utf8'));
  const labels={top_down:'俯視',macro_closeup:'蜂體特寫',low_angle_anti_clip:'低角度防穿模',wireframe:'線框結構'};
  const html=`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>毒舌評審 · 四視角報告</title><style>body{margin:0;background:#11181b;color:#eaf0ee;font:16px/1.6 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:32px}h1{font-size:28px;margin:0}small{color:#a9bbb5;overflow-wrap:anywhere}.status{font-size:22px;color:${result.status==='approved'?'#8ce6b0':'#ffae91'};margin:12px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{background:#1d292c;border-radius:12px;overflow:hidden}article img{display:block;width:100%}article div{padding:18px}h2{font-size:20px;margin:0}p{margin:10px 0}a{color:#a9ded0}li{margin:8px 0}@media(max-width:800px){main{padding:16px}.grid{grid-template-columns:1fr}}</style><main><h1>毒舌評審 · 四視角報告</h1><div class="status">${result.status==='approved'?'通過':'退回修改'} · 平均 ${escape(result.mean?.toFixed(2))}/10</div><p>每張皆須達 9/10，且沒有阻擋問題。</p><small>輪次 ${escape(manifest.roundId)} · 獨立評審 ${escape(review.reviewer?.runId)}</small><div class="grid">${manifest.images.map(im=>{
    const rv=review.views.find(v=>v.view===im.view);const url=path.relative(path.join(root,'.quality'),im.path).split(path.sep).join('/');
    return `<article><a href="${escape(url)}"><img src="${escape(url)}" alt="${escape(labels[im.view])}"></a><div><h2>${escape(labels[im.view])} · ${escape(rv?.score)}/10</h2><p>${escape(rv?.evidence)}</p></div></article>`;
  }).join('')}</div><h2>優先修正</h2><ol>${(review.repairs||[]).map(t=>`<li>${escape(t)}</li>`).join('')}</ol>${review.blockers?.length?'<h2>阻擋問題</h2><ul>'+review.blockers.map(t=>`<li>${escape(t)}</li>`).join('')+'</ul>':''}<p><a href="latest.json">驗證結果</a> · <a href="${escape(path.relative(path.join(root,'.quality'),result.review).split(path.sep).join('/'))}">完整原始評語</a></p></main></html>`;
  await fs.writeFile(path.join(root,'.quality','report.html'),html);
}
async function writeStatus(status,message) {
  await fs.writeFile(path.join(root,'.quality','report.html'),`<!doctype html><meta charset="utf-8"><title>毒舌評審</title><main style="font:18px/1.7 system-ui;padding:40px"><h1>${escape(status)}</h1><p>${escape(message)}</p><p>目前沒有新版本的通過證明。<a href="latest.json">檢查最新狀態</a></p></main>`);
}
module.exports={writeReport,writeStatus};
if(require.main===module) (async()=>writeReport(JSON.parse(await fs.readFile(path.join(root,'.quality','latest.json'),'utf8'))))().catch(e=>{console.error(e);process.exitCode=1;});
