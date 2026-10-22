// Gate contract tests use synthetic fixtures only; these are not visual reviews.
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {root,views,hash,inputs,gate}=require('./capture-review.cjs');
let sharp;try {sharp=require('sharp');}catch {sharp=require(require('node:path').join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));}
(async()=>{
  const dir=await fs.mkdtemp(path.join(root,'.quality','gate-test-'));
  let count=0;
  try {
    const artifact=path.join(dir,'fixture.html');await fs.writeFile(artifact,'test-only');
    const images=[];
    for(const [index,view] of views.entries()){const file=path.join(dir,view+'.png');await sharp({create:{width:1280,height:960,channels:3,background:{r:index*60,g:0,b:0}}}).png().toFile(file);images.push({view,path:file,sha256:hash(await fs.readFile(file)),diagnostics:{mode:'FORAGING',camera:'diagnostic',materialsReady:true}});}
    const manifest={roundId:'fixture-only',artifact,artifactSha256:hash(await fs.readFile(artifact)),sourceHashes:await inputs(),images,errors:[],pose:'FORAGING',viewport:{width:1280,height:960}};
    const valid={roundId:manifest.roundId,artifactSha256:manifest.artifactSha256,reviewer:{role:'independent-adversarial-critic',runId:'test-only'},views:images.map(i=>({view:i.view,imageSha256:i.sha256,score:9,evidence:'synthetic test assertion'})),blockers:[]};
    const raw=JSON.stringify({views:valid.views.map(({imageSha256,...v})=>v),blockers:[]});
    const events=JSON.stringify({type:'thread.started',thread_id:'test-only'})+'\n'+JSON.stringify({type:'turn.completed'});
    await fs.writeFile(path.join(dir,'critic-output.json'),raw);
    await fs.writeFile(path.join(dir,'critic-events.jsonl'),events);
    await fs.writeFile(path.join(dir,'critic-receipt.json'),JSON.stringify({roundId:manifest.roundId,runId:'test-only',outputSha256:hash(raw),eventsSha256:hash(events)}));
    async function check(edit,approved=false){const m=structuredClone(manifest),r=structuredClone(valid);edit(m,r);await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(m));await fs.writeFile(path.join(dir,'review.json'),JSON.stringify(r));assert.equal((await gate(dir,{publish:false})).status,approved?'approved':'rejected');count++;}
    await check(()=>{},true);
    await check((m,r)=>r.views[0].score=8.99);
    await check((m,r)=>r.views[0].score='9');
    await check((m,r)=>r.views.pop());
    await check((m,r)=>r.views[1]=r.views[0]);
    await check((m,r)=>r.views[0].imageSha256='old-image');
    await check((m,r)=>r.views[0].evidence='');
    await check((m,r)=>r.roundId='old-round');
    await check((m,r)=>r.artifactSha256='old-build');
    await check((m,r)=>m.sourceHashes['bee_scene.html']='old-source');
    await check((m,r)=>r.blockers=['hidden foot contact']);
    await check((m,r)=>delete r.reviewer);
    await check((m,r)=>m.errors=['renderer failed']);
    await check((m,r)=>m.images[0].diagnostics.mode='FLYING');
    await check((m,r)=>r.reviewer.runId='made-up');
    await fs.writeFile(images[0].path,'changed-image');await check(()=>{});
    await fs.unlink(images[0].path);await assert.rejects(()=>gate(dir,{publish:false}));count++;
    console.log(`${count} quality-gate contract checks passed (synthetic fixtures, no visual approval).`);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
