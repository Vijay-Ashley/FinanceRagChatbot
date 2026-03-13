# Deploy to GitHub Script
# This script builds UI and pushes changes to GitHub

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploy to GitHub - Invoice RAG v3" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build UI
Write-Host "Step 1: Building UI..." -ForegroundColor Yellow
.\build_ui.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ UI build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Git status
Write-Host "Step 2: Checking git status..." -ForegroundColor Yellow
git status

Write-Host ""

# Step 3: Add files
Write-Host "Step 3: Adding files to git..." -ForegroundColor Yellow

# Add backend files
git add app.py
git add cosmos_hybrid_retriever.py
git add cosmos_store.py
git add metadata_extractor.py
git add query_classifier.py
git add requirements.txt

# Add built UI (public folder)
git add public/

# Add deployment guides
git add VM_DEPLOYMENT_STEPS.md
git add QUICK_DEPLOY.md
git add prepare_deployment.ps1
git add deploy_to_github.ps1

Write-Host "✅ Files added!" -ForegroundColor Green
Write-Host ""

# Step 4: Commit
Write-Host "Step 4: Committing changes..." -ForegroundColor Yellow
$commitMessage = Read-Host "Enter commit message (or press Enter for default)"

if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = "Fix: Deduplicate sources - show only unique documents"
}

git commit -m "$commitMessage"

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ No changes to commit or commit failed" -ForegroundColor Yellow
    Write-Host ""
}

# Step 5: Push
Write-Host ""
Write-Host "Step 5: Pushing to GitHub..." -ForegroundColor Yellow

$branch = git branch --show-current
Write-Host "Current branch: $branch" -ForegroundColor Gray

git push origin $branch

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Repository: https://github.com/Vijay-Ashley/FinanceInvoiceRag" -ForegroundColor White
    Write-Host ""
    Write-Host "Next Steps (On VM):" -ForegroundColor Yellow
    Write-Host "  1. SSH to VM:" -ForegroundColor White
    Write-Host "     ssh your-username@your-vm-ip" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Navigate to project:" -ForegroundColor White
    Write-Host "     cd /path/to/FinanceInvoiceRag" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Pull latest changes:" -ForegroundColor White
    Write-Host "     git pull origin $branch" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  4. Restart service:" -ForegroundColor White
    Write-Host "     sudo systemctl restart invoice-rag" -ForegroundColor Gray
    Write-Host "     # OR if running manually:" -ForegroundColor Gray
    Write-Host "     # Kill old process and restart" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ❌ Push failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  1. Not authenticated - run: git config credential.helper store" -ForegroundColor White
    Write-Host "  2. Remote not set - run: git remote add origin <url>" -ForegroundColor White
    Write-Host "  3. Branch not tracking - run: git push -u origin $branch" -ForegroundColor White
    Write-Host ""
}

Write-Host ""

