import { CategorieReco, PrioriteReco, StadeProjet, StatutProjet, StatutReco } from './ai.models';

/** Libellés affichés dans l'interface pour les énumérations du module IA. */

export const STADES: Record<StadeProjet, string> = {
  idee: 'Idée',
  prototype: 'Prototype',
  lancement: 'Lancement',
  croissance: 'Croissance',
};

export const STATUTS_PROJET: Record<StatutProjet, { libelle: string; variante: 'succes' | 'attention' | 'neutre' }> = {
  brouillon: { libelle: 'Brouillon', variante: 'neutre' },
  actif: { libelle: 'Actif', variante: 'succes' },
  archive: { libelle: 'Archivé', variante: 'attention' },
};

export const CATEGORIES: Record<CategorieReco, string> = {
  marche: 'Marché',
  financier: 'Financier',
  juridique: 'Juridique',
  produit: 'Produit',
  equipe: 'Équipe',
};

export const PRIORITES: Record<PrioriteReco, { libelle: string; variante: 'danger' | 'attention' | 'info' }> = {
  haute: { libelle: 'Haute', variante: 'danger' },
  moyenne: { libelle: 'Moyenne', variante: 'attention' },
  basse: { libelle: 'Basse', variante: 'info' },
};

export const STATUTS_RECO: Record<StatutReco, string> = {
  nouvelle: 'Nouvelle',
  appliquee: 'Appliquée',
  ignoree: 'Ignorée',
};

