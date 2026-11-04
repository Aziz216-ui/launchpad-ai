/**
 * Configuration de développement (ng serve). Mêmes clés que environment.ts :
 * chaque membre renseigne uniquement la clé de son service.
 */
export const environment = {
  production: false,

  /** Market-Service (module Étude de marché, features/market). */
  marketApiUrl: 'http://localhost:8090/api/market',
  /** AI-Service (module Co-Fondateur IA, features/ai) : à remplir par le membre concerné. */
  aiApiUrl: '',
  /** Finance-Service (module Finance, features/finance). Chemin relatif : proxy.conf.json en développement (ng serve), API Gateway en production. */
  financeApiUrl: '/api/finance',
  /** Legal-Service (module Juridique, features/legal) : à remplir par le membre concerné. */
  legalApiUrl: '',
  /** Professional-Service (Comptabilité et Avocat, features/professional) : à remplir par le membre concerné. */
  professionalApiUrl: '',
  /** User-Service (comptes, authentification, features/auth) : à remplir par le membre concerné. */
  userApiUrl: '',

  /** Utilisateur provisoire, en attendant le User-Service et son token JWT. */
  utilisateur: {
    entrepreneurId: 101,
    projetId: 1,
  },
};
