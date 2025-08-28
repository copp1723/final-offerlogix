#!/bin/bash

echo "🔍 OfferLogix Git Status Assessment"
echo "=================================="
echo ""

echo "📍 Current branch:"
git branch --show-current
echo ""

echo "🌿 All branches:"
git branch -a
echo ""

echo "📊 Commits ahead of main:"
echo "Commits on current branch not on main:"
git log main..HEAD --oneline | head -10
echo ""

echo "📊 Commits behind main:"
echo "Commits on main not on current branch:"
git log HEAD..main --oneline | head -10
echo ""

echo "📈 Branch divergence:"
git rev-list --left-right --count main...HEAD
echo ""

echo "🏷️  Latest commit on each branch:"
echo "Current branch latest:"
git log -1 --oneline
echo "Main branch latest:"
git log main -1 --oneline
echo ""

echo "✅ Assessment complete!"
