# Deployment Preparation Script for Invoice RAG v3
# This script builds the UI and prepares files for VM deployment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Invoice RAG v3 - Deployment Prep" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build UI
Write-Host "Step 1: Building UI..." -ForegroundColor Yellow
Push-Location ui

# Clean old build
Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    npm install
}

# Build
npm run build

if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "❌ UI build failed!" -ForegroundColor Red
    exit 1
}

Pop-Location
Write-Host "✅ UI build successful!" -ForegroundColor Green
Write-Host ""

# Step 2: Copy to public folder
Write-Host "Step 2: Copying build to public folder..." -ForegroundColor Yellow
Remove-Item -Path "public" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path "ui\dist" -Destination "public" -Recurse -Force
Write-Host "✅ UI deployed to public folder!" -ForegroundColor Green
Write-Host ""

# Step 3: Create deployment package
Write-Host "Step 3: Creating deployment package..." -ForegroundColor Yellow

# Create deployment folder
$deployFolder = "deployment_package"
Remove-Item -Path $deployFolder -Recurse -Force -ErrorAction SilentlyContinue
New-Item -Path $deployFolder -ItemType Directory -Force | Out-Null

# Copy necessary files
$filesToCopy = @(
    "app.py",
    "cosmos_hybrid_retriever.py",
    "cosmos_store.py",
    "metadata_extractor.py",
    "query_classifier.py",
    "requirements.txt"
)

foreach ($file in $filesToCopy) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination $deployFolder -Force
        Write-Host "  ✓ Copied $file" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠ Warning: $file not found" -ForegroundColor Yellow
    }
}

# Copy public folder
Copy-Item -Path "public" -Destination "$deployFolder\public" -Recurse -Force
Write-Host "  ✓ Copied public folder" -ForegroundColor Gray

# Create empty uploads folder
New-Item -Path "$deployFolder\uploads" -ItemType Directory -Force | Out-Null
Write-Host "  ✓ Created uploads folder" -ForegroundColor Gray

Write-Host "✅ Deployment package created!" -ForegroundColor Green
Write-Host ""

# Step 4: Create zip file
Write-Host "Step 4: Creating zip file..." -ForegroundColor Yellow
$zipFile = "invoice-rag-v3-deployment.zip"
Remove-Item -Path $zipFile -Force -ErrorAction SilentlyContinue

Compress-Archive -Path "$deployFolder\*" -DestinationPath $zipFile -Force

if (Test-Path $zipFile) {
    $zipSize = (Get-Item $zipFile).Length / 1MB
    Write-Host "✅ Zip file created: $zipFile ($([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to create zip file!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 5: Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deployment Package Ready!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 Package location: $zipFile" -ForegroundColor White
Write-Host "📁 Folder location: $deployFolder\" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Transfer to VM using SCP:" -ForegroundColor White
Write-Host "     scp $zipFile your-username@your-vm-ip:/home/your-username/" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. On VM, extract and deploy:" -ForegroundColor White
Write-Host "     unzip $zipFile -d invoice-rag-v3" -ForegroundColor Gray
Write-Host "     cd invoice-rag-v3" -ForegroundColor Gray
Write-Host "     python3 -m venv .venv" -ForegroundColor Gray
Write-Host "     source .venv/bin/activate" -ForegroundColor Gray
Write-Host "     pip install -r requirements.txt" -ForegroundColor Gray
Write-Host "     python -m uvicorn app:app --host 0.0.0.0 --port 9000" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. See VM_DEPLOYMENT_STEPS.md for full guide" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Optional: Open deployment folder
$openFolder = Read-Host "Open deployment folder? (y/n)"
if ($openFolder -eq "y") {
    Invoke-Item $deployFolder
}

