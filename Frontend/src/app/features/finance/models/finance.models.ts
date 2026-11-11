/** Réponses et requêtes du Finance-Service (voir les DTO du backend, package dto). */

export interface Projection {
  annee: number;
  chiffreAffaires: number;
  depenses: number;
  marge: number;
}

/** Avis du financier sur une prévision. */
export type StatutValidation = 'EN_ATTENTE' | 'VALIDEE' | 'REJETEE';

export interface Validation {
  statut: StatutValidation;
  /** Commentaire, auteur et date sont null tant que la prévision est EN_ATTENTE. */
  commentaire: string | null;
  auteur: string | null;
  le: string | null;
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
  validation: Validation;
}

export interface AvisSaisie {
  decision: 'VALIDEE' | 'REJETEE';
  /** Obligatoire pour un rejet. */
  commentaire?: string | null;
}

// --- Rôles sur un projet -----------------------------------------------------

/** Rôle sur UN projet : propriétaire (entrepreneur), financier invité, administrateur ou aucun. */
export type RoleProjet = 'PROPRIETAIRE' | 'FINANCIER' | 'ADMIN' | 'AUCUN';

/** Droits de l'utilisateur connecté sur le projet courant (calculés par le backend). */
export interface DroitsProjet {
  projetId: number;
  role: RoleProjet;
  /** Consulter prévisions, projections et documents. */
  lecture: boolean;
  /** Saisir, générer, supprimer, inviter des financiers (propriétaire). */
  ecriture: boolean;
  /** Valider les prévisions et certifier les documents (financier invité). */
  validation: boolean;
}

export interface ProjetAccessible {
  projetId: number;
  role: RoleProjet;
  depuis: string;
  previsionsEnAttente: number;
}

/**
 * Projet de la plateforme, tel que le connaît le Projet-Service (module IA) : c'est son identifiant que
 * Finance utilise comme projetId. L'utilisateur ne voit que le titre.
 */
export interface ProjetPlateforme {
  id: number;
  entrepreneur_id: number;
  titre: string;
  secteur: string;
  stade: 'idee' | 'prototype' | 'lancement' | 'croissance';
  statut: 'brouillon' | 'actif' | 'archive';
  date_creation: string;
}

export interface ProjetPlateformeSaisie {
  titre: string;
  secteur: string;
  stade: ProjetPlateforme['stade'];
}

export type TypeNotification = 'DOCUMENT_GENERE' | 'DOCUMENT_CERTIFIE' | 'PREVISION_A_VALIDER' | 'PREVISION_VALIDEE' | 'PREVISION_REJETEE';

/** Notification issue des événements RabbitMQ, déjà filtrée par le backend selon le rôle sur le projet. */
export interface NotificationFinance {
  type: TypeNotification;
  pour: 'PROPRIETAIRE' | 'FINANCIER' | 'TOUS';
  projetId: number;
  message: string;
  recueLe: string;
  documentId: string | null;
  previsionId: string | null;
}

export interface MembreProjet {
  projetId: number;
  email: string;
  role: RoleProjet;
  ajouteLe: string;
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

/** Certification d'un document par un financier invité (null tant que non certifié). */
export interface Certification {
  auteur: string;
  commentaire: string | null;
  le: string;
}

export interface DocumentResume {
  documentId: string;
  projetId: number;
  type: TypeDocument;
  titre: string;
  creeLe: string;
  certification: Certification | null;
}

export interface DocumentFinancier {
  documentId: string;
  projetId: number;
  type: TypeDocument;
  creeLe: string;
  contenu: ContenuDocument;
  /** Prévision dont le document est tiré : elle doit être validée pour que le document soit certifié. */
  previsionId: string | null;
  certification: Certification | null;
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
