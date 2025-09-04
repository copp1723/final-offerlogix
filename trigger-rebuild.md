# Force Rebuild Trigger

This file is created to trigger a new deployment with a timestamp.

Deployment timestamp: 2025-08-25 02:04:00 UTC

Issues identified:
- Webhook returns 500 when processing real emails
- Minimal payloads work fine (200 OK)
- Problem occurs during AI processing or lead creation
- Database connectivity is working
- Environment variables appear to be set

The deployment may not have fully picked up the foreign key constraint fixes.