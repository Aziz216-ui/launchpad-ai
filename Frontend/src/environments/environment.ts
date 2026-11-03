/**
 * Configuration de production : une URL par microservice.
 * Quand l'API Gateway sera en place, il suffira de remplacer ces URL par celle de la gateway.
 * Chaque membre renseigne uniquement la clé de son service, ici ET dans environment.development.ts.
 */
export const environment = {
  production: true,

  /** Market-Service (module Étude de marché, features/market). */
  marketApiUrl: 'http://localhost:8005/api/market',
  /** AI-Service (module Co-Fondateur IA, features/ai) : à remplir par le membre concerné. */
  aiApiUrl: '',
  /** Finance-Service (module Finance, features/finance) : à remplir par le membre concerné. */
  financeApiUrl: '',
  /** Legal-Service (module Juridique, features/legal) : à remplir par le membre concerné. */
  legalApiUrl: '',
  /** Professional-Service (Comptabilité et Avocat, features/professional) : à remplir par le membre concerné. */
  professionalApiUrl: '',
  /** User-Service (comptes, authentification, features/auth) : à remplir par le membre concerné. */
  userApiUrl: '',

  /**
   * Utilisateur provisoire, en attendant le User-Service et son token JWT :
   * affiché dans la barre latérale et utilisé à la création d'une étude de marché.
   */
  utilisateur: {
    entrepreneurId: 101,
    projetId: 1,
  },
};
