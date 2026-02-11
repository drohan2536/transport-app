$ErrorActionPreference = "Stop"

Write-Host "Initializing Git..."
git init

Write-Host "Adding files..."
git add .

Write-Host "Committing..."
# Check if there are changes to commit
if ((git status --porcelain) -ne "") {
    git commit -m "Initial commit of transport app"
} else {
    Write-Host "Nothing to commit or working tree clean."
}

Write-Host "Renaming branch to main..."
git branch -M main

Write-Host "Configuring remote..."
$remoteUrl = "https://github.com/drohan2536/transport-app.git"
if (git remote | Select-String "origin") {
    Write-Host "Updating existing origin..."
    git remote set-url origin $remoteUrl
} else {
    Write-Host "Adding new origin..."
    git remote add origin $remoteUrl
}

Write-Host "Pushing to GitHub..."
git push -u origin main
