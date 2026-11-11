import { VarianteBadge } from '../../../shared/components/badge.component';
import { RoleProjet, StatutEcart, StatutValidation, TypeDocument } from './finance.models';

/** Devise d'affichage des montants (le Finance-Service stocke des montants sans devise). */
export const DEVISE = 'TND';

export const TYPES_DOCUMENT: { valeur: TypeDocument; libelle: string }[] = [
  { valeur: 'BUSINESS_PLAN', libelle: 'Business plan' },
  { valeur: 'BILAN_OUVERTURE', libelle: "Bilan d'ouverture" },
  { valeur: 'COMPTE_RESULTAT', libelle: 'Compte de résultat prévisionnel' },
  { valeur: 'PLAN_TRESORERIE', libelle: 'Plan de trésorerie' },
  { valeur: 'RAPPORT_INVESTISSEUR', libelle: 'Rapport investisseur' },
];

export function libelleType(type: TypeDocument): string {
  return TYPES_DOCUMENT.find((t) => t.valeur === type)?.libelle ?? type;
}

export const STATUTS_ECART: Record<StatutEcart, { libelle: string; variante: VarianteBadge }> = {
  EXCEDENT: { libelle: 'Excédent', variante: 'succes' },
  EQUILIBRE: { libelle: 'Équilibre', variante: 'neutre' },
  DEFICIT: { libelle: 'Déficit', variante: 'danger' },
};

export const STATUTS_VALIDATION: Record<StatutValidation, { libelle: string; variante: VarianteBadge }> = {
  EN_ATTENTE: { libelle: 'En attente d’avis', variante: 'attention' },
  VALIDEE: { libelle: 'Validée', variante: 'succes' },
  REJETEE: { libelle: 'Rejetée', variante: 'danger' },
};

export const ROLES_PROJET: Record<RoleProjet, string> = {
  PROPRIETAIRE: 'Propriétaire',
  FINANCIER: 'Financier invité',
  ADMIN: 'Administrateur',
  AUCUN: 'Aucun accès',
};
