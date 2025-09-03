Conversation Observability (V2)

This project now exposes lightweight, read-only endpoints to safely monitor live conversations handled by the V2 pipeline (Mailgun threading + Drizzle schema).

Enable V2 and the debug view:

- Set `V2_MAILGUN_ENABLED=true` to mount the `/v2` router.
- Set `V2_DEBUG_VIEW_ENABLED=true` to enable the HTML debug view.

Endpoints

- `GET /v2/conversations` — List recent conversations
  - Query params: `agentId`, `status`, `limit` (default 50, max 200)
  - Response: `{ success: true, conversations: [...] }`

- `GET /v2/conversations/:id` — Fetch a single conversation
  - Response: `{ success: true, conversation: { ... } }`

- `GET /v2/conversations/:id/messages` — List messages for a conversation
  - Response: `{ success: true, messages: [...] }`

- `GET /v2/conversations/debug` — HTML, read-only, auto-refreshing viewer (requires `V2_DEBUG_VIEW_ENABLED=true`)
  - Optional `?limit=20` to control how many recent conversations are shown

Notes

- The debug view is intentionally simple (no auth, no JS) and disabled by default via `V2_DEBUG_VIEW_ENABLED`.
- Data shown comes from V2 tables: `conversations_v2` and `messages_v2`.
- The page refreshes every 5 seconds and shows the last 5 messages per conversation.

