#!/bin/bash

# PushPOC.sh - Quick push to GitHub (triggers Vercel deploy)

echo "=== BitPOC Deploy Script ==="
echo "Current branch: $(git branch --show-current)"
echo "Recent commits:"
git log --oneline -5

echo ""
read -p "Enter commit message for push (or press Enter to skip and just push): " message

if [ ! -z "$message" ]; then
  echo "Adding all changes..."
  git add .
  echo "Committing: $message"
  git commit -m "$message"
fi

echo "Pushing to origin main..."
git push origin main

echo ""
echo "🎉 Push complete! Vercel should start deploying in a few seconds."
echo "Check your Vercel dashboard for the new deployment."
echo ""
echo "Live URL: https://bitpoc-explorer.vercel.app"
echo "GitHub: https://github.com/MichaelPlumb32207/bitpoc-explorer"

open "https://vercel.com/michaelplumb32207/bitpoc-explorer/deployments"
