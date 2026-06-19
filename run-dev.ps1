# Run Synapse dev server (no system Node.js required)
$nodeBin = Join-Path $PSScriptRoot ".tools\nodejs\node-v22.16.0-win-x64"
if (-not (Test-Path (Join-Path $nodeBin "npm.cmd"))) {
    Write-Error "Portable Node.js not found at $nodeBin. Install Node.js from https://nodejs.org or run setup once."
    exit 1
}
$env:PATH = "$nodeBin;$env:PATH"
Set-Location $PSScriptRoot
if (-not (Test-Path "node_modules\vite")) {
    Write-Host "Installing dependencies..."
    npm install
}
Write-Host "Starting dev server at http://localhost:5173/"
npm run dev
