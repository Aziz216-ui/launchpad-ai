import { VarianteBadge } from '../../../shared/components/badge.component';
import {
  ImpactTendance,
  NiveauConcurrence,
  NiveauPotentiel,
  PositionnementPrix,
  StatutEtude,
  TypeSwot,
} from './market.models';

/** Libellés et couleurs affichés pour les valeurs codées de l'API. */

export const STATUTS: Record<StatutEtude, { libelle: string; variante: VarianteBadge }> = {
  brouillon: { libelle: 'Brouillon', variante: 'attention' },
  finalisee: { libelle: 'Finalisée', variante: 'succes' },
};

export const NIVEAUX: Record<NiveauConcurrence, { libelle: string; couleur: string; barres: number }> = {
  inconnu: { libelle: 'Inconnu', couleur: '#5A6A6F', barres: 0 },
  faible: { libelle: 'Faible', couleur: '#24704C', barres: 1 },
  moyen: { libelle: 'Moyen', couleur: '#C47A0A', barres: 2 },
  eleve: { libelle: 'Élevé', couleur: '#B23A3A', barres: 3 },
};

/** Ordre de tri du plus concurrentiel au moins concurrentiel. */
export const ORDRE_NIVEAUX: NiveauConcurrence[] = ['eleve', 'moyen', 'faible', 'inconnu'];

export const IMPACTS: Record<ImpactTendance, { libelle: string; variante: VarianteBadge }> = {
  positif: { libelle: 'Impact positif', variante: 'succes' },
  negatif: { libelle: 'Impact négatif', variante: 'danger' },
  neutre: { libelle: 'Impact neutre', variante: 'neutre' },
};

export const POSITIONNEMENTS: Record<PositionnementPrix, string> = {
  inconnu: 'inconnu',
  economique: 'économique',
  aligne: 'aligné',
  premium: 'premium',
};

export const POTENTIELS: Record<NiveauPotentiel, { libelle: string; variante: VarianteBadge }> = {
  faible: { libelle: 'Faible', variante: 'danger' },
  moyen: { libelle: 'Moyen', variante: 'attention' },
  fort: { libelle: 'Fort', variante: 'succes' },
};

export const TYPES_SWOT: {
  type: TypeSwot;
  libelle: string;
  lettre: string;
  nature: string;
  fond: string;
  accent: string;
  titre: string;
  compteur: string;
}[] = [
  { type: 'force', libelle: 'Forces', lettre: 'F', nature: 'Interne · positif', fond: '#E8F5EE', accent: '#24704C', titre: '#1C5A3D', compteur: '#24704C' },
  { type: 'faiblesse', libelle: 'Faiblesses', lettre: 'F', nature: 'Interne · négatif', fond: '#FBEDED', accent: '#B23A3A', titre: '#8E2B2B', compteur: '#B23A3A' },
  { type: 'opportunite', libelle: 'Opportunités', lettre: 'O', nature: 'Externe · positif', fond: '#E3F0F1', accent: '#1F6470', titre: '#174E57', compteur: '#1F6470' },
  { type: 'menace', libelle: 'Menaces', lettre: 'M', nature: 'Externe · négatif', fond: '#FDF3E3', accent: '#9A5B07', titre: '#7A4805', compteur: '#9A5B07' },
];

export const LIBELLE_TYPE_SWOT: Record<TypeSwot, string> = {
  force: 'Force',
  faiblesse: 'Faiblesse',
  opportunite: 'Opportunité',
  menace: 'Menace',
};
