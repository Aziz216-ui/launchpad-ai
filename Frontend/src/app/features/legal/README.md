# Module Juridique

**Service backend :** Legal-Service (via l'API Gateway, `environment.legalApiUrl` = `/api/legal`)
**URL :** `/juridique` (entrepreneur) et `/juridique/revue` (avocat, lien « Documents » de la barre latérale)

```
features/legal/
├── legal.routes.ts                    # routes + rôles (roleGuard)
├── models/legal.models.ts             # contrat JSON, libellés, champs du formulaire par type
├── services/legal-api.service.ts      # appels /documents/** (entrepreneur) et /verification/** (avocat)
├── components/clauses.component.ts    # clauses avec édition en place
├── components/commentaires.component.ts  # notes, questions et réponses
└── pages/
    ├── documents/   # /juridique : liste filtrée (type, statut) + « Nouveau document »
    ├── nouveau/     # /juridique/nouveau : choix du type puis formulaire → POST /documents/generate
    ├── document/    # /juridique/documents/:id : lecture, envoi avocat, suivi, signatures, PDF, archivage
    └── revue/       # /juridique/revue et /revue/:id : revue avocat (modifier, noter, questionner, valider/refuser, signer)
```

## Parcours

- **Entrepreneur** : créer (BROUILLON, clauses pré-remplies) → relire (lecture seule) → envoyer à un avocat
  (EN_VALIDATION) → suivre notes et questions (et y répondre) → si VALIDE, demander les signatures → PDF, archivage.
- **Avocat** : liste « À revoir » (EN_VALIDATION) → seul à modifier le document (titre, titres et textes des clauses), ajouter des notes, poser des questions →
  valider (VALIDE) ou refuser avec motif (REFUSE) → signer (SIGNE).
- **projetId** : le Legal-Service ne connaît pas les utilisateurs ; chaque entrepreneur a son espace `ent-<username>`
  (`LegalApiService.projetCourant`), il ne voit donc que ses documents. ADMIN voit tous les projets.
- **Suppression** : la Gateway réserve DELETE au rôle ADMIN ; le bouton n'est proposé qu'à lui.
- Comptes de démo : `adem` / `Adem@2026!` (entrepreneur), `sarra` / `Avocat@2026!` (avocat).

## Règles

- Tout le code du module reste dans ce dossier.
- N'importer que depuis `core/`, `shared/` et ce dossier : **jamais** depuis le dossier d'un
  autre module, et ne jamais modifier le dossier d'un autre membre.
- Les styles du module restent dans ses composants ; `src/styles.scss` ne contient que les
  variables et le reset. Les couleurs de la charte sont disponibles via `@use 'variables' as *;`.
- Disponible dans `shared/` : badge, modale de confirmation, état vide, loader, toasts, icônes.
  Dans `core/` : `NotificationService` (toasts) et l'intercepteur HTTP (erreurs, futur JWT).
