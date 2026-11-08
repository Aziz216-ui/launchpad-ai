import { VarianteBadge } from '../../../shared/components/badge.component';
import { StatutEcart, TypeDocument } from './finance.models';

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
