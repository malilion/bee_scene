param([switch]$BundleOnly, [ValidateRange(1,20)][int]$MaxRounds = 3)
$ErrorActionPreference = 'Stop'
$sceneRoot = $PSScriptRoot
if (-not $BundleOnly) {
    $sceneNode = $env:SCENE_NODE
    if (-not $sceneNode) {
        $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
        if ($nodeCommand) { $sceneNode = $nodeCommand.Source }
        else { $sceneNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
    }
    & $sceneNode (Join-Path $sceneRoot '.buildtools/quality-loop.cjs') "--max-rounds=$MaxRounds"
    if ($LASTEXITCODE -ne 0) { throw 'Visual acceptance failed; see .quality/latest.json.' }
    return
}
$sourcePath = Join-Path $sceneRoot 'bee_scene.html'
$buildRoot = Join-Path $sceneRoot '.buildtools'
$sourceText = [IO.File]::ReadAllText($sourcePath)
$moduleMatch = [regex]::Match($sourceText, '(?s)<script type="module">(.*?)</script>')
if (-not $moduleMatch.Success) { throw 'Scene module not found.' }
$utf8 = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path $buildRoot 'source/scene.js'), $moduleMatch.Groups[1].Value, $utf8)
[IO.File]::WriteAllText((Join-Path $buildRoot 'tsconfig.json'), '{"compilerOptions":{"baseUrl":"..","paths":{"three":["vendor/three/three.module.js"],"three/addons/*":["vendor/three/addons/*"],"@scene-textures":["assets/texture-data.js"]}}}', $utf8)
$bundler = Join-Path $buildRoot 'package/esbuild.exe'
$bundlePath = Join-Path $buildRoot 'scene.bundle.js'
$bundleArgs = @((Join-Path $buildRoot 'source/scene.js'), '--bundle', '--format=iife', '--minify', '--target=es2020', ('--tsconfig=' + (Join-Path $buildRoot 'tsconfig.json')), ('--outfile=' + $bundlePath), '--legal-comments=eof')
& $bundler @bundleArgs
if ($LASTEXITCODE -ne 0) { throw 'Scene bundling failed.' }
$bundleText = [IO.File]::ReadAllText($bundlePath)
$standalone = [regex]::Replace($sourceText, '(?s)<script type="importmap">.*?</script>', '')
$standalone = [regex]::Replace($standalone, '(?s)<script type="module">.*?</script>', [Text.RegularExpressions.MatchEvaluator]{ param($match) '<script>' + $bundleText + '</script>' })
$standalonePath = Join-Path $sceneRoot 'bee_scene_standalone.html'
$stagedPath = Join-Path $sceneRoot ('bee_scene_standalone.' + [guid]::NewGuid().ToString('N') + '.tmp')
$artifactPath = $standalonePath
try {
    if (-not [IO.File]::Exists($standalonePath) -or [IO.File]::ReadAllText($standalonePath) -cne $standalone) {
        [IO.File]::WriteAllText($stagedPath, $standalone, $utf8)
        if ([IO.File]::Exists($standalonePath)) { [IO.File]::Replace($stagedPath, $standalonePath, [NullString]::Value) }
        else { [IO.File]::Move($stagedPath, $standalonePath) }
    }
} catch [IO.IOException] {
    # An editor/browser may map the open file. Keep a new reviewable build instead.
    $buildDirectory = Join-Path $sceneRoot '.quality/builds'
    [IO.Directory]::CreateDirectory($buildDirectory) | Out-Null
    $buildHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($utf8.GetBytes($standalone))).Replace('-', '').ToLowerInvariant()
    $artifactPath = Join-Path $buildDirectory ('bee_scene-' + $buildHash + '.html')
    [IO.File]::WriteAllText($artifactPath, $standalone, $utf8)
    Write-Warning "Open standalone file is locked; current build is $artifactPath"
} finally {
    if ([IO.File]::Exists($stagedPath)) { [IO.File]::Delete($stagedPath) }
}
[IO.File]::WriteAllText((Join-Path $sceneRoot '.quality/build-artifact.json'), (@{ artifact = $artifactPath } | ConvertTo-Json), $utf8)
[IO.File]::WriteAllText((Join-Path $sceneRoot '.quality/latest.json'), '{"status":"unreviewed_build"}', $utf8)
Write-Output "Built $artifactPath (offline, no server required; awaiting visual review)"
