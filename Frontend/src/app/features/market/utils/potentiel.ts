import { RapportEtude } from '../models/market.models';

/**
 * Rapport dont le score du potentiel commercial est borné entre 0 et score_max (7).
 * Le serveur borne déjà le score ; ce garde-fou évite qu'une ancienne version de l'API
 * affiche -1/7. La justification (+2, -1…) reste inchangée.
 */
export function avecScoreBorne(rapport: RapportEtude): RapportEtude {
  const p = rapport.potentiel_commercial;
  const score = Math.max(0, Math.min(p.score_max, p.score));
  return score === p.score ? rapport : { ...rapport, potentiel_commercial: { ...p, score } };
}
