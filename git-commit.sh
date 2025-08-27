#!/bin/bash

# Navigate to the repository directory
cd /Users/joshcopp/Desktop/Swarm/OFFERLOGIX

# Add all modified files
git add .

# Commit with descriptive message
git commit -m "CRITICAL FIX: Email threading and formatting issues

- Fixed double HTML sanitization breaking AI-formatted emails
- Fixed sender identity from 'OneKeel Swarm' to 'Brittany Simpson'  
- Simplified email threading logic to prevent new threads for replies
- Enhanced HTML preservation for properly formatted AI content
- Fixed formatEmailContent to respect existing HTML paragraph tags
- Updated credit solutions prompt with direct, results-focused messaging

Resolves: Threading breaking conversations, awful formatting, wrong sender"

# Push to remote
git push

echo "Changes committed and pushed successfully!"
