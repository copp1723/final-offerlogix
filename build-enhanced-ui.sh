#!/bin/bash

echo "🎨 Building MailMind Dashboard with Enhanced UI..."
echo "================================================"

cd /Users/joshcopp/Desktop/MailMind/dashboard

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the dashboard
echo "🔨 Building the enhanced UI..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Dashboard built successfully!"
    echo ""
    echo "🎉 UI Enhancements Applied:"
    echo "  • Premium glassmorphism effects with backdrop blur"
    echo "  • Vibrant gradient backgrounds and animations"
    echo "  • Modern card designs with depth and shadows"
    echo "  • Smooth hover effects and transitions"
    echo "  • Interactive floating animations"
    echo "  • Professional badges and status indicators"
    echo "  • Enhanced typography and visual hierarchy"
    echo ""
    echo "📝 To run the dashboard:"
    echo "  cd /Users/joshcopp/Desktop/MailMind/dashboard"
    echo "  npm run dev"
    echo ""
    echo "🌐 Then open http://localhost:3001 in your browser"
else
    echo "❌ Build failed. Please check the error messages above."
fi