#!/bin/bash

# CommitPOC.sh - Quick commit for BitPOC development

if [ -z "$1" ]; then
  echo "Error: Please provide a commit message."
  echo "Usage: ./CommitPOC.sh \"Your descriptive message here\""
  exit 1
fi

echo "Adding all changes..."
git add .

echo "Committing with message: $1"
git commit -m "$1"

echo "Commit complete! 🎉"
git log --oneline -1
