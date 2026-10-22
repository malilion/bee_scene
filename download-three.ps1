$ErrorActionPreference = 'Stop'
$baseUri = [Uri]'https://unpkg.com/three@0.160.0/examples/jsm/'
$queue = [System.Collections.Generic.Queue[string]]::new()
@('controls/OrbitControls.js','postprocessing/EffectComposer.js','postprocessing/RenderPass.js','postprocessing/UnrealBloomPass.js','postprocessing/OutputPass.js','postprocessing/BokehPass.js') | ForEach-Object { $queue.Enqueue($_) }
$seen = @{}
while ($queue.Count -gt 0) {
  $relative = $queue.Dequeue()
  if ($seen.ContainsKey($relative)) { continue }
  $seen[$relative] = $true
  $uri = [Uri]::new($baseUri, $relative)
  $target = Join-Path 'D:\test\vendor\three\addons' $relative
  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
  Invoke-WebRequest -Uri $uri.AbsoluteUri -OutFile $target
  $content = Get-Content -LiteralPath $target -Raw
  foreach ($match in [regex]::Matches($content, "from\s+['""](\.[^'""]+)['""]")) {
    $child = [Uri]::new($uri, $match.Groups[1].Value)
    $childRelative = $baseUri.MakeRelativeUri($child).ToString()
    if (-not $childRelative.StartsWith('..')) { $queue.Enqueue($childRelative) }
  }
}
Write-Output ("Downloaded " + $seen.Count + " Three.js addons")
