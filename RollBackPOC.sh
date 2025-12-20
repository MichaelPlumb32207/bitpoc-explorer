#!/bin/bash

# RollBackPOC.sh - Quick rollback for BitPOC development

echo "Current commit history (most recent first):"
git log --oneline -5

echo ""
echo "Options:"
echo "1. Roll back last commit (git reset --hard HEAD~1)"
echo "2. Roll back to a specific commit (you'll enter the hash)"
echo "3. Just show history and exit"

read -p "Choose option (1-3): " choice

case $choice in
  1)
    echo "Rolling back last commit..."
    git reset --hard HEAD~1
    echo "Rollback complete! You are now at:"
    git log --oneline -1
    ;;
  2)
    read -p "Enter commit hash to reset to (e.g. a1b2c3d): " hash
    git reset --hard $hash
    echo "Reset to commit $hash"
    git log --oneline -1
    ;;
  3)
    echo "No changes made. Exiting."
    ;;
  *)
    echo "Invalid option. Exiting."
    ;;
esac
