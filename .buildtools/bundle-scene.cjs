const fs = require('node:fs/promises');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');

async function main() {
  const source = await fs.readFile(path.join(root, 'bee_scene.html'), 'utf8');
  const match = source.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Scene module not found');
  await fs.mkdir(path.join(__dirname, 'source'), {recursive:true});
  await fs.writeFile(path.join(__dirname, 'source/scene.js'), match[1]);
  const binary = process.env.ESBUILD_BINARY || (process.platform === 'win32' ? path.join(__dirname,'package/esbuild.exe') : 'esbuild');
  const result = spawnSync(binary, [path.join(__dirname,'source/scene.js'), '--bundle', '--format=iife', '--minify', '--target=es2020', '--tsconfig='+path.join(__dirname,'tsconfig.json'), '--outfile='+path.join(__dirname,'scene.bundle.js'), '--legal-comments=eof'], {cwd:root,stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Scene bundling failed');
  const bundle = await fs.readFile(path.join(__dirname,'scene.bundle.js'), 'utf8');
  const standalone = source.replace(/<script type="importmap">[\s\S]*?<\/script>/, '').replace(/<script type="module">[\s\S]*?<\/script>/, () => '<script>'+bundle+'</script>');
  const artifact = path.join(root,'index.html');
  const staging = artifact+'.tmp';
  await fs.writeFile(staging,standalone);
  await fs.rename(staging,artifact);
  await fs.writeFile(path.join(root,'.quality/build-artifact.json'),JSON.stringify({artifact},null,2));
  await fs.writeFile(path.join(root,'.quality/latest.json'),JSON.stringify({status:'unreviewed_build'},null,2));
  console.log('Built '+artifact+' (awaiting independent visual review)');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
