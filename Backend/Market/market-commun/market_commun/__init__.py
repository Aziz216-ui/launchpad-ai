"""
market_commun : code technique partagé par les 4 microservices de l'étude de marché.

Chaque service garde son code métier, sa base, son port, son nom Eureka et son
déploiement ; seuls les mécanismes techniques identiques sont ici :

- reglages.py   : réglages Django communs (sécurité, base, CSRF, CORS, DRF, logs, Eureka, RabbitMQ)
- eureka.py     : enregistrement du service dans Eureka (démarré par apps.py)
- clients.py    : client REST de base (résolution Eureka, timeout, nouvelle tentative, 404 / 503)
- concurrence.py: niveau de concurrence (règle unique : 0 concurrent -> "inconnu") et prix moyen
- identite.py   : utilisateur connecté lu dans le jeton transmis par la gateway (sub, username, rôles)
- exceptions.py : gestionnaire d'erreurs DRF (ServiceIndisponible -> 503 JSON)
- filtres.py    : filtre ?ids=1,2,3
- vues.py       : health check
- urls.py       : routes communes (admin, Swagger, health)
- evenements/   : producer, consumer, outbox RabbitMQ (app Django, label "evenements")
- testing.py    : aides pour les tests des services
"""
