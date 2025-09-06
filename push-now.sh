#!/bin/bash
echo "Enter GitHub Personal Access Token:"
read -s TOKEN
echo ""
echo "Pushing to GitHub..."
git push https://IKEMENLTD:${TOKEN}@github.com/IKEMENLTD/gasgenerator.git main --force