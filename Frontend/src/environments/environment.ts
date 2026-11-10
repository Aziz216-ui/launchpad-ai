/**
 * Configuration de production : une URL par microservice.
 * Tous les services passent par l'API Gateway (http://localhost:8090).
 * Chaque membre renseigne uniquement la clé de son service, ici ET dans environment.development.ts.
 */
export const environment = {
  production: true,

  /** Market-Service (module Étude de marché, features/market). */
  marketApiUrl: 'http://localhost:8090/api/market',
  /** AI-Service (module Co-Fondateur IA, features/ai). Exposé via l'API Gateway (port 8090). */
  aiApiUrl: 'http://localhost:8090/api/ai',
  /** Finance : Prevision-Service et Document-Service, via l'API Gateway (module Finance, features/finance). */
  financeApiUrl: 'http://localhost:8090/api/finance',
  /** Legal-Service (module Juridique, features/legal), via l'API Gateway. */
  legalApiUrl: 'http://localhost:8090/api/legal',
  /** Espace comptable (4 microservices Symfony, features/professional), via l'API Gateway. */
  professionalApiUrl: 'http://localhost:8090/api/comptable',
  /** Espace avocat : 3 microservices (clients, messages, revue de documents), via l'API Gateway. */
  lawyerApiUrl: 'http://localhost:8090/api/lawyer',
  /** User-Service (comptes, authentification Keycloak, features/auth), via l'API Gateway. */
  userApiUrl: 'http://localhost:8090/api/auth',

  /**
   * Utilisateur provisoire, en attendant le User-Service et son token JWT :
   * affiché dans la barre latérale et utilisé à la création d'une étude de marché.
   */
  utilisateur: {
    entrepreneurId: 101,
    projetId: 1,
  },
};
