"""
Communication asynchrone entre les microservices du marché (RabbitMQ, bibliothèque pika).

Producer -> Exchange "market.events" (topic) -> Queue -> Consumer.

- rabbitmq.py     : paramètres de connexion et déclaration de la topologie (exchange, DLQ)
- producteur.py   : publier(event, data) après le commit ; outbox si RabbitMQ est indisponible
- relais.py       : renvoi automatique de l'outbox (toutes les 10 s)
- consommateur.py : boucle de consommation (ack manuel, prefetch 1, 3 tentatives puis DLQ,
                    idempotence par message_id, reconnexion automatique)
- management/commands/consume_events.py : lance les consumers déclarés dans
                    settings.EVENEMENTS_CONSOMMES

Package partagé par les 4 services (bibliothèque market-commun) ; chaque service déclare
ses événements dans config/settings.py (EVENEMENTS_PUBLIES, EVENEMENTS_CONSOMMES).
"""
