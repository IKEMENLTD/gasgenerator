# Windows PowerShell Script for GitHub API Update
Write-Host "🔧 GitHub API Update Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$GITHUB_TOKEN = "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"
$OWNER = "IKEMENLTD"
$REPO = "gasgenerator"
$BRANCH = "main"

$headers = @{
    "Authorization" = "token $GITHUB_TOKEN"
    "Accept" = "application/vnd.github.v3+json"
}

Write-Host "✅ Token configured" -ForegroundColor Green
Write-Host ""

function Update-GitHubFile {
    param(
        [string]$FilePath,
        [string]$CommitMessage,
        [string]$LocalFile
    )
    
    Write-Host "📝 Updating $FilePath..." -ForegroundColor Yellow
    
    # Get current file SHA
    $uri = "https://api.github.com/repos/$OWNER/$REPO/contents/$FilePath`?ref=$BRANCH"
    try {
        $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
        $sha = $response.sha
        Write-Host "   SHA obtained: $($sha.Substring(0, 7))..." -ForegroundColor Gray
    }
    catch {
        Write-Host "   ⚠️ Could not get SHA, creating as new file" -ForegroundColor Yellow
        $sha = $null
    }
    
    # Read and encode file content
    $content = [System.IO.File]::ReadAllText($LocalFile)
    $contentBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
    $contentBase64 = [System.Convert]::ToBase64String($contentBytes)
    
    # Prepare update payload
    $body = @{
        message = $CommitMessage
        content = $contentBase64
        branch = $BRANCH
    }
    
    if ($sha) {
        $body.sha = $sha
    }
    
    # Update file
    $updateUri = "https://api.github.com/repos/$OWNER/$REPO/contents/$FilePath"
    try {
        $result = Invoke-RestMethod -Uri $updateUri -Headers $headers -Method Put -Body ($body | ConvertTo-Json)
        Write-Host "   ✅ File updated successfully!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "   ❌ Failed to update file" -ForegroundColor Red
        Write-Host "   Error: $_" -ForegroundColor Red
        return $false
    }
}

Write-Host "🚀 Starting file updates..." -ForegroundColor Cyan
Write-Host ""

# Update environment.ts
$envSuccess = Update-GitHubFile `
    -FilePath "lib/config/environment.ts" `
    -CommitMessage "Fix: Move ADMIN_API_TOKEN to optional environment variables" `
    -LocalFile "lib/config/environment.ts"

if ($envSuccess) {
    # Update jwt-manager.ts
    $jwtSuccess = Update-GitHubFile `
        -FilePath "lib/auth/jwt-manager.ts" `
        -CommitMessage "Fix: Change ADMIN_API_TOKEN to optional with default value" `
        -LocalFile "lib/auth/jwt-manager.ts"
    
    if ($jwtSuccess) {
        Write-Host ""
        Write-Host "================================" -ForegroundColor Green
        Write-Host "✅ All files updated successfully!" -ForegroundColor Green
        Write-Host "================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Check commits: https://github.com/$OWNER/$REPO/commits/$BRANCH" -ForegroundColor Cyan
        Write-Host "🚀 Render will auto-deploy soon!" -ForegroundColor Yellow
        Write-Host "📦 Render Dashboard: https://dashboard.render.com/" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")