# Co-Fondateur IA — Recommandation-Service

Microservice **Recommandation-Service** (port 8007).
Gère les recommandations et prochaines étapes pour les projets entrepreneuriaux.

Endpoints :
- `GET /api/ai/recommandations/` (filtre `?projet=`, `?categorie=`, `?priorite=`, `?statut=`)
- `POST /api/ai/recommandations/`
- `GET /api/ai/recommandations/<id>/`
- `PATCH /api/ai/recommandations/<id>/statut/`
- `POST /api/ai/recommandations/generer/`
- `GET /api/ai/health/`

