#!/bin/bash

# Dark Mode Implementation Git Commit Script
echo "🎨 Committing Dark Mode Implementation..."
echo "================================"

# Navigate to the project directory
cd "$(dirname "$0")"

# Check git status
echo "📋 Current git status:"
git status --short

# Add all changes
echo ""
echo "➕ Adding all changes..."
git add .

# Commit with detailed message
echo ""
echo "💾 Committing changes..."
git commit -m "✨ feat: Complete dark mode implementation with OfferLogix branding

- Added comprehensive dark mode support across all components
- Implemented ThemeProvider with system/light/dark options  
- Created beautiful theme toggle with Sun/Moon/Monitor icons
- Maintained OfferLogix teal and orange brand colors in dark theme
- Added dark mode gradients and proper contrast ratios
- Integrated theme toggle in both desktop and mobile layouts
- All pages now support seamless theme switching
- Theme preference persists across browser sessions
- Professional dark UI with enhanced user experience"

# Push to remote
echo ""
echo "🚀 Pushing to remote repository..."
git push origin main

echo ""
echo "✅ Dark mode implementation successfully committed and pushed!"
echo "🎉 Your OfferLogix platform now has beautiful dark mode!"
