import { VarianteBadge } from '../../../shared/components/badge.component';
import {
  ImpactTendance,
  NiveauConcurrence,
  NiveauPotentiel,
  PositionnementPrix,
  StatutEtude,
  TypeSwot,
} from './market.models';

/** Libell├⌐s et couleurs affich├⌐s pour les valeurs cod├⌐es de l'API. */

export const STATUTS: Record<StatutEtude, { libelle: string; variante: VarianteBadge }> = {
  brouillon: { libelle: 'Brouillon', variante: 'attention' },
  finalisee: { libelle: 'Finalis├⌐e', variante: 'succes' },
};

export const NIVEAUX: Record<NiveauConcurrence, { libelle: string; couleur: string; barres: number }> = {
  inconnu: { libelle: 'Inconnu', couleur: '#5A6A6F', barres: 0 },
  faible: { libelle: 'Faible', couleur: '#24704C', barres: 1 },
  moyen: { libelle: 'Moyen', couleur: '#C47A0A', barres: 2 },
  eleve: { libelle: '├ëlev├⌐', couleur: '#B23A3A', barres: 3 },
};

/** Sous-titre de la carte ┬½ Niveau de concurrence ┬╗ de l'aper├ºu (maquette Apercu.dc.html). */
export const SOUS_TITRES_NIVEAU: Record<NiveauConcurrence, string> = {
  inconnu: "Associez des concurrents pour l'├⌐valuer",
  faible: 'March├⌐ encore peu occup├⌐',
  moyen: 'March├⌐ encore diff├⌐renciable',
  eleve: 'March├⌐ d├⌐j├á tr├¿s occup├⌐',
};

/** Ordre de tri du plus concurrentiel au moins concurrentiel. */
export const ORDRE_NIVEAUX: NiveauConcurrence[] = ['eleve', 'moyen', 'faible', 'inconnu'];

export const IMPACTS: Record<ImpactTendance, { libelle: string; variante: VarianteBadge }> = {
  positif: { libelle: 'Impact positif', variante: 'succes' },
  negatif: { libelle: 'Impact n├⌐gatif', variante: 'danger' },
  neutre: { libelle: 'Impact neutre', variante: 'neutre' },
};

export const POSITIONNEMENTS: Record<PositionnementPrix, string> = {
  inconnu: 'inconnu',
  economique: '├⌐conomique',
  aligne: 'align├⌐',
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
  { type: 'force', libelle: 'Forces', lettre: 'F', nature: 'Interne ┬╖ positif', fond: '#E8F5EE', accent: '#24704C', titre: '#1C5A3D', compteur: '#24704C' },
  { type: 'faiblesse', libelle: 'Faiblesses', lettre: 'F', nature: 'Interne ┬╖ n├⌐gatif', fond: '#FBEDED', accent: '#B23A3A', titre: '#8E2B2B', compteur: '#B23A3A' },
  { type: 'opportunite', libelle: 'Opportunit├⌐s', lettre: 'O', nature: 'Externe ┬╖ positif', fond: '#E3F0F1', accent: '#1F6470', titre: '#174E57', compteur: '#1F6470' },
  { type: 'menace', libelle: 'Menaces', lettre: 'M', nature: 'Externe ┬╖ n├⌐gatif', fond: '#FDF3E3', accent: '#9A5B07', titre: '#7A4805', compteur: '#9A5B07' },
];

export const LIBELLE_TYPE_SWOT: Record<TypeSwot, string> = {
  force: 'Force',
  faiblesse: 'Faiblesse',
  opportunite: 'Opportunit├⌐',
  menace: 'Menace',
};
