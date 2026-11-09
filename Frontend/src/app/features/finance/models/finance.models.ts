/** Réponses et requêtes du Finance-Service (voir les DTO du backend, package dto). */

export interface Projection {
  annee: number;
  chiffreAffaires: number;
  depenses: number;
  marge: number;
}

export interface Prevision {
  previsionId: string;
  projetId: number;
  periode: string;
  chiffreAffaires: number;
  coutsDirects: number;
  depenses: number;
  resultat: number;
  creeLe: string;
  projections: Projection[];
}

export interface PrevisionSaisie {
  projetId: number;
  periode: string;
  chiffreAffaires: number;
  coutsDirects: number;
  depenses: number;
}

export interface Marges {
  previsionId: string;
  margeBrute: number;
  margeNette: number;
  /** En % du chiffre d'affaires. */
  tauxMargeBrute: number;
  tauxMargeNette: number;
}

export type StatutEcart = 'EXCEDENT' | 'EQUILIBRE' | 'DEFICIT';

export interface Ecart {
  previsionId: string;
  montant: number;
  pourcentage: number;
  statut: StatutEcart;
}

export interface CommentaireIa {
  previsionId: string;
  commentaire: string;
}

export interface ProjectionsSaisie {
  /** Évolution annuelle en % (10 = +10 % par an). */
  tauxCa: number;
  tauxDepenses: number;
  horizon: number;
}

export type TypeDocument =
  | 'BUSINESS_PLAN'
  | 'BILAN_OUVERTURE'
  | 'COMPTE_RESULTAT'
  | 'PLAN_TRESORERIE'
  | 'RAPPORT_INVESTISSEUR';

export interface LigneDocument {
  libelle: string;
  valeurs: number[];
}

export interface SectionDocument {
  titre: string;
  colonnes: string[];
  lignes: LigneDocument[];
  notes: string[];
}

export interface ContenuDocument {
  titre: string;
  sections: SectionDocument[];
}

export interface DocumentResume {
  documentId: string;
  projetId: number;
  type: TypeDocument;
  titre: string;
  creeLe: string;
}

export interface DocumentFinancier {
  documentId: string;
  projetId: number;
  type: TypeDocument;
  creeLe: string;
  contenu: ContenuDocument;
}

export interface DocumentSaisie {
  projetId: number;
  type: TypeDocument;
  tresorerieInitiale?: number | null;
  avecAnalyse: boolean;
}

export type FormatExport = 'pdf' | 'xlsx';

export interface ReponseAssistant {
  projetId: number;
  reponse: string;
}
