const fs=require('node:fs/promises');
const path=require('node:path');
const Module=require('node:module');
const assert=require('node:assert/strict');
(async()=>{
  const filename=path.join(__dirname,'quality-loop.cjs');
  const source=(await fs.readFile(filename,'utf8')).replace('module.exports={critic,repair};','module.exports={critic,repair,run};');
  const testModule=new Module(filename,module);
  testModule.filename=filename;testModule.paths=module.paths;
  testModule._compile(source,filename);
  const dir=await fs.mkdtemp(path.resolve(__dirname,'../.quality/runner-test-'));
  try {
    await assert.rejects(()=>testModule.exports.run('definitely-missing-scene-reviewer.exe',[],'',path.join(dir,'missing.log'),'critic'),{code:'ENOENT'});
    await assert.rejects(()=>testModule.exports.run(process.execPath,['-e','process.exit(7)'],'',path.join(dir,'exit.log'),'critic'),/exited 7/);
    console.log('Runner catches missing executable and nonzero child exit.');
  } finally {await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
