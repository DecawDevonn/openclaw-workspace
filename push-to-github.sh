#!/bin/bash
# Push OpenClaw workspace to GitHub
# Usage: ./push-to-github.sh YOUR_GITHUB_USERNAME

if [ -z "$1" ]; then
    echo "Usage: ./push-to-github.sh YOUR_GITHUB_USERNAME"
    echo ""
    echo "Example: ./push-to-github.sh johndoe"
    echo ""
    echo "Note: You need to create the repo on GitHub first:"
    echo "  https://github.com/new"
    echo ""
    exit 1
fi

USERNAME=$1
REPO_NAME="openclaw-workspace"

echo "🚀 Pushing to GitHub..."
echo "   Repo: $USERNAME/$REPO_NAME"
echo ""

# Check if remote exists and update it
if git remote get-url origin > /dev/null 2>&1; then
    echo "📝 Updating existing remote..."
    git remote set-url origin "https://github.com/$USERNAME/$REPO_NAME.git"
else
    echo "🔗 Adding remote..."
    git remote add origin "https://github.com/$USERNAME/$REPO_NAME.git"
fi

# Push
echo "📤 Pushing code..."
git branch -M main
git push -u origin main

echo ""
echo "✅ Done!"
echo "   Visit: https://github.com/$USERNAME/$REPO_NAME"
