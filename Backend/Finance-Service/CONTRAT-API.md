# Contrat d'intégration — Finance (Prevision-Service et Document-Service)

Ce document décrit ce que les autres services de LaunchPad peuvent appeler ou écouter côté Finance.
La documentation complète et interactive (Swagger) reste disponible sur chaque service
(voir « Accès »). Les exemples ci-dessous sont des réponses réelles.

## 1. Accès

| | Prevision-Service | Document-Service |
|---|---|---|
| Rôle | Prévisions, marges, écarts, projections, IA | Documents financiers, export PDF / Excel, notifications |
| Nom Eureka | `PREVISION-SERVICE` | `DOCUMENT-SERVICE` |
| Port | 8081 | 8083 |
| Swagger | http://localhost:8081/swagger-ui.html | http://localhost:8083/swagger-ui.html |

**Passez par l'API Gateway** : `http://localhost:8090/api/finance/...`. Elle envoie
`/api/finance/documents/**`, `/api/finance/projets/*/documents` et `/api/finance/projets/*/notifications`
au Document-Service, et tout le reste de `/api/finance/**` au Prevision-Service.
Un service Spring peut aussi appeler directement `lb://PREVISION-SERVICE` ou `lb://DOCUMENT-SERVICE`.

## 2. Conventions

- **JSON** en entrée et en sortie (`Content-Type: application/json`), sauf l'export (fichier).
- **Identifiants** : UUID (`projetId`, `previsionId`, `documentId`). Le projet n'est référencé que par
  son identifiant : Finance ne vérifie pas son existence auprès d'un autre service.
- **Montants** : nombres décimaux à 2 décimales (`100000.00`), sans devise. Taux en % (`60.00` = 60 %).
- **Dates** : texte ISO-8601 en UTC (`"2026-11-05T13:00:36.010103Z"`).
- **Erreurs** : format ProblemDetail (RFC 7807), voir la section 5.

## 3. Endpoints

| Méthode | Chemin | Service | Rôle | Succès |
|---|---|---|---|---|
| POST | `/api/finance/previsions` | Prévision | Créer une prévision | 201 |
| GET | `/api/finance/previsions/{previsionId}` | Prévision | Une prévision et ses projections | 200 |
| GET | `/api/finance/projets/{projetId}/previsions` | Prévision | Prévisions d'un projet, de la plus récente à la plus ancienne | 200 |
| GET | `/api/finance/projets/{projetId}/synthese` | Prévision | Dernière prévision + marges + écart, en un appel | 200 |
| GET | `/api/finance/previsions/{previsionId}/marges` | Prévision | Marges brute et nette | 200 |
| GET | `/api/finance/previsions/{previsionId}/ecart` | Prévision | Écart revenus / dépenses | 200 |
| POST | `/api/finance/previsions/{previsionId}/projections` | Prévision | Générer les projections (remplace les précédentes) | 201 |
| GET | `/api/finance/previsions/{previsionId}/projections` | Prévision | Projections existantes | 200 |
| POST | `/api/finance/previsions/{previsionId}/commentaire` | Prévision | Commentaire de l'écart rédigé par l'IA | 200 |
| POST | `/api/finance/projets/{projetId}/assistant` | Prévision | Question à l'assistant financier IA | 200 |
| POST | `/api/finance/documents` | Document | Générer un document financier | 201 |
| GET | `/api/finance/projets/{projetId}/documents` | Document | Documents d'un projet (sans contenu) | 200 |
| GET | `/api/finance/documents/{documentId}` | Document | Un document avec son contenu | 200 |
| GET | `/api/finance/documents/{documentId}/export?format=pdf\|xlsx` | Document | Télécharger le fichier | 200 |
| DELETE | `/api/finance/documents/{documentId}` | Document | Supprimer le document et ses fichiers | 204 |
| GET | `/api/finance/projets/{projetId}/notifications` | Document | Notifications reçues via RabbitMQ | 200 |

`POST /api/finance/ia/analyse` (Prévision) est **interne** : il sert au Document-Service. Ne l'appelez pas.

### Créer une prévision

```http
POST /api/finance/previsions
```
```json
{ "projetId": "f3645458-1181-46e2-aac3-b012fdbde0f6", "periode": "2026",
  "chiffreAffaires": 100000, "coutsDirects": 40000, "depenses": 70000 }
```
Règles : `periode` obligatoire (50 caractères max) ; montants ≥ 0, 13 chiffres et 2 décimales max ;
`coutsDirects` ≤ `depenses` (les dépenses incluent les coûts directs).

Réponse `201` (en-tête `Location` vers la prévision créée) :
```json
{ "previsionId": "0d1b4c32-b9e5-4223-9ad5-efc92ef32af7", "projetId": "f3645458-1181-46e2-aac3-b012fdbde0f6",
  "periode": "2026", "chiffreAffaires": 100000.00, "coutsDirects": 40000.00, "depenses": 70000.00,
  "resultat": 30000.00, "creeLe": "2026-11-05T13:00:36.010103Z", "projections": [] }
```
`GET /api/finance/projets/{projetId}/previsions` renvoie une liste de ces objets.

### Marges et écart (utilisés par le tableau de bord comptable)

```json
{ "previsionId": "0d1b4c32-…", "margeBrute": 60000.00, "margeNette": 30000.00,
  "tauxMargeBrute": 60.00, "tauxMargeNette": 30.00 }
```
```json
{ "previsionId": "0d1b4c32-…", "montant": 30000.00, "pourcentage": 30.00, "statut": "EXCEDENT" }
```
`statut` : `EXCEDENT` (montant > 0), `EQUILIBRE` (= 0) ou `DEFICIT` (< 0). `pourcentage` = montant / CA × 100.

### Synthèse d'un projet (un seul appel)

`GET /api/finance/projets/{projetId}/synthese` → `{ "prevision": {…}, "marges": {…}, "ecart": {…} }`, avec la
prévision la plus récente (et ses projections) et ses marges et écart. `404` si le projet n'a aucune prévision.
C'est l'appel le plus simple pour un service qui veut « les chiffres du projet » (par exemple le Co-fondateur IA).

### Projections

```http
POST /api/finance/previsions/{previsionId}/projections
```
```json
{ "tauxCa": 10, "tauxDepenses": 5, "horizon": 2 }
```
Taux annuels en % (strictement supérieurs à -100) ; `horizon` de 1 à 10 ans. Réponse `201` :
```json
[ { "annee": 1, "chiffreAffaires": 110000.00, "depenses": 73500.00, "marge": 36500.00 },
  { "annee": 2, "chiffreAffaires": 121000.00, "depenses": 77175.00, "marge": 43825.00 } ]
```

### Documents

```http
POST /api/finance/documents
```
```json
{ "projetId": "f3645458-1181-46e2-aac3-b012fdbde0f6", "type": "COMPTE_RESULTAT",
  "tresorerieInitiale": 5000, "avecAnalyse": false }
```
- `type` : `BUSINESS_PLAN`, `BILAN_OUVERTURE`, `COMPTE_RESULTAT`, `PLAN_TRESORERIE`, `RAPPORT_INVESTISSEUR`.
- `tresorerieInitiale` (facultatif, ≥ 0) : utilisée par le bilan d'ouverture et le plan de trésorerie.
- `avecAnalyse` (facultatif, `false` par défaut) : ajoute une section « Analyse (rédigée par IA) ».
- Le document est construit à partir de la **prévision la plus récente** du projet (`404` s'il n'y en a pas).

Réponse `201` : `{ "documentId", "projetId", "type", "creeLe", "contenu": { "titre", "sections": [ … ] } }`,
chaque section ayant `titre`, `colonnes`, `lignes` (`libelle` + `valeurs`) et `notes`.
La liste `GET /api/finance/projets/{projetId}/documents` renvoie seulement
`{ "documentId", "projetId", "type", "titre", "creeLe" }`.

Export : `GET /api/finance/documents/{documentId}/export?format=pdf` (ou `xlsx`) renvoie le fichier avec
`Content-Disposition: attachment; filename="compte-resultat-<documentId>.pdf"`.

## 4. Codes de retour

| Code | Quand |
|---|---|
| 200 / 201 / 204 | Succès |
| 400 | Champ invalide, règle métier non respectée, format d'export inconnu, JSON illisible |
| 404 | Prévision, document ou projet sans prévision introuvable |
| 503 | IA non configurée ou indisponible ; l'autre service Finance est injoignable |
| 500 | Erreur inattendue (le détail est seulement dans les journaux du service) |

Via l'API Gateway, un service Finance arrêté donne aussi un `503`, au format de la passerelle :
`{ "service": "DOCUMENT-SERVICE", "message": "Service indisponible" }`.

## 5. Format des erreurs

Champs invalides (`400`) — le détail par champ est dans `erreurs` :
```json
{ "type": "about:blank", "title": "Données invalides", "status": 400,
  "detail": "La requête contient des champs invalides", "instance": "/api/finance/previsions",
  "erreurs": { "chiffreAffaires": "doit être supérieur ou égal à 0", "periode": "ne doit pas être vide" } }
```
Règle métier (`400`) :
```json
{ "type": "about:blank", "title": "Données invalides", "status": 400,
  "detail": "coutsDirects ne peut pas dépasser depenses (les dépenses incluent les coûts directs)",
  "instance": "/api/finance/previsions" }
```
Introuvable (`404`) :
```json
{ "type": "about:blank", "title": "Ressource introuvable", "status": 404,
  "detail": "Prévision introuvable : 00000000-0000-0000-0000-000000000000",
  "instance": "/api/finance/previsions/00000000-0000-0000-0000-000000000000" }
```
IA indisponible (`503`) :
```json
{ "type": "about:blank", "title": "IA indisponible", "status": 503,
  "detail": "Le service d'IA n'est pas configuré", "instance": "/api/finance/previsions/…/commentaire" }
```

## 6. Événement RabbitMQ : `DocumentGenere`

Publié par le Document-Service **après l'enregistrement** d'un document (jamais pour une génération en échec).

| | |
|---|---|
| Broker | RabbitMQ, `localhost:5672` en local |
| Exchange | exchange par défaut (`""`) |
| Queue / clé de routage | `finance.document.genere` (durable) |
| Message | persistant, `content_type: application/json`, UTF-8 |
| Livraison | au moins une fois : un même événement peut arriver deux fois |

Corps du message :
```json
{ "documentId": "3b262c72-2222-4f01-9de3-6fb7669e7ce6",
  "projetId": "f3645458-1181-46e2-aac3-b012fdbde0f6",
  "type": "COMPTE_RESULTAT",
  "titre": "Compte de résultat prévisionnel - période 2026",
  "creeLe": "2026-11-05T13:00:36.525402Z" }
```

| Champ | Type | Description |
|---|---|---|
| `documentId` | UUID (texte) | Identifiant du document ; clé de dédoublonnage |
| `projetId` | UUID (texte) | Projet concerné |
| `type` | texte | Un des 5 types de document (section 3) |
| `titre` | texte | Titre lisible du document |
| `creeLe` | date ISO-8601 UTC | Date de génération |

Le message ne contient jamais le contenu du document : pour l'obtenir, appelez
`GET /api/finance/documents/{documentId}`.

**Pour consommer cet événement depuis un autre service :**
- Ignorez l'en-tête `__TypeId__` (nom de classe Java, utile seulement à Spring).
- Traitez le message de façon idempotente (par `documentId`).
- Ignorez les champs que vous ne connaissez pas : de nouveaux champs pourront être ajoutés.
- **Aujourd'hui, la queue a un seul consommateur** (les notifications du Document-Service). Avec l'exchange par
  défaut, deux services qui lisent la même queue se **partageraient** les messages au lieu de les recevoir tous
  les deux. Si votre service a besoin de cet événement, prévenez l'équipe Finance : l'événement sera publié sur un
  exchange de type `topic` (par exemple `finance.evenements`), et chaque service déclarera sa propre queue.

## 7. Limites actuelles

- **Pas d'authentification** côté Finance pour l'instant (la passerelle tourne avec `JWT_ENABLED=false`) et pas
  de contrôle du propriétaire du projet : à faire avec le User-Service.
- **`projetId` est un UUID.** Les services qui utilisent un entier ou une autre forme d'identifiant de projet
  devront se mettre d'accord avec Finance sur un identifiant commun.
- **IA** (commentaire, analyse, assistant) : `503` tant que le Prevision-Service n'a pas de clé xAI.
- **Notifications** : gardées en mémoire (50 dernières), perdues au redémarrage du Document-Service.
- **En-tête `Location` via la passerelle** : il contient pour l'instant l'adresse interne du service
  (`http://localhost:8081/...` ou `:8083/...`), car la passerelle ne transmet pas encore les en-têtes
  `X-Forwarded-*` (il faut définir `spring.cloud.gateway.server.webflux.trusted-proxies` dans l'API Gateway).
  Les services Finance en tiennent déjà compte dès qu'ils les reçoivent. En attendant, utilisez l'identifiant
  renvoyé dans le corps de la réponse plutôt que l'en-tête `Location`.
