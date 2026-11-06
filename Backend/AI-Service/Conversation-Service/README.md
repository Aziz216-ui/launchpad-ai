# Co-Fondateur IA — Conversation-Service

Microservice **Conversation-Service** (port 8008).
Gère les sessions de chat avec le Co-Fondateur IA et l'historique des messages.

Endpoints :
- `GET /api/ai/conversations/` (filtre `?projet=`)
- `POST /api/ai/conversations/`
- `GET /api/ai/conversations/<id>/` (avec historique complet des messages)
- `DELETE /api/ai/conversations/<id>/`
- `POST /api/ai/conversations/<id>/messages/` (poser une question, génère la réponse IA)
- `GET /api/ai/health/`

