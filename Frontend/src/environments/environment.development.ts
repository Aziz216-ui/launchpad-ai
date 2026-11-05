/**
 * Configuration de développement (ng serve). Mêmes clés que environment.ts :
 * chaque membre renseigne uniquement la clé de son service.
 */
export const environment = {
  production: false,

  /** Market-Service (module Étude de marché, features/market). */
  marketApiUrl: 'http://localhost:8090/api/market',
  /** AI-Service (module Co-Fondateur IA, features/ai). Exposé via l'API Gateway (port 8090). */
  aiApiUrl: 'http://localhost:8090/api/ai',
  /** Finance-Service (module Finance, features/finance) : à remplir par le membre concerné. */
  financeApiUrl: '',
  /** Legal-Service (module Juridique, features/legal) : à remplir par le membre concerné. */
  legalApiUrl: '',
  /** Professional-Service (Comptabilité et Avocat, features/professional) : à remplir par le membre concerné. */
  professionalApiUrl: '',
  /** Espace avocat : 3 microservices (clients, messages, revue de documents), via l'API Gateway. */
  lawyerApiUrl: 'http://localhost:8090/api/lawyer',
  /** User-Service (comptes, authentification Keycloak, features/auth), via l'API Gateway. */
  userApiUrl: 'http://localhost:8090/api/auth',

  /** Utilisateur provisoire, en attendant le User-Service et son token JWT. */
  utilisateur: {
    entrepreneurId: 101,
    projetId: 1,
  },
};
