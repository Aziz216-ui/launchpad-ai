/**
 * Contrats JSON de l'espace avocat (via l'API Gateway) :
 *  - annuaire : User-Service GET /api/auth/lawyers/ (utilisateurs de rôle LAWYER) ;
 *  - Lawyer-Client-Service (/api/lawyer/clients), Lawyer-Message-Service (/api/lawyer/messages),
 *    Lawyer-DocReview-Service (/api/lawyer/reviews) : tous indexés par l'en-tête X-Lawyer-Id
 *    (identifiant de connexion de l'avocat) ;
 *  - documents juridiques de l'entrepreneur : Legal-Service (/api/legal/documents).
 */

export interface Avocat {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
}

/** Fiche client d'un entrepreneur chez un avocat : c'est le lien entre les deux. */
export interface ClientAvocat {
  id: number;
  lawyerId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  notes: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
}

export interface MessageAvocat {
  id: number;
  lawyerId: string;
  clientId: number;
  clientName: string | null;
  senderType: 'LAWYER' | 'CLIENT';
  subject: string;
  content: string;
  sentAt: string;
  isRead: boolean;
}

export type StatutDemande = 'PENDING' | 'IN_PROGRESS' | 'NEEDS_CORRECTION' | 'APPROVED' | 'REJECTED';

export interface CommentaireRevue {
  id: number;
  author: string;
  pageNumber: number | null;
  commentText: string;
  correctionRequested: boolean;
  createdAt: string;
}

export interface HistoriqueRevue {
  id: number;
  oldStatus: StatutDemande | null;
  newStatus: StatutDemande;
  changedBy: string;
  reason: string | null;
  timestamp: string;
}

/** Demande de revue d'un document envoyée à un avocat (Lawyer-DocReview-Service). */
export interface DemandeRevue {
  id: number;
  lawyerId: string;
  clientId: number;
  clientName: string | null;
  clientEmail: string | null;
  documentTitle: string;
  documentType: string;
  /** « legal-document:<uuid> » : document du Legal-Service (module Juridique). */
  documentUrl: string;
  status: StatutDemande;
  createdAt: string;
  updatedAt: string;
  comments: CommentaireRevue[];
  history: HistoriqueRevue[];
}

/** Document juridique de l'entrepreneur (Legal-Service), proposé dans la demande. */
export interface DocumentJuridiqueResume {
  id: string;
  titre: string;
  type: 'STATUTS' | 'CONTRAT' | 'NDA' | 'PV';
  statut: 'BROUILLON' | 'EN_VALIDATION' | 'VALIDE' | 'REFUSE' | 'SIGNE';
  version: number;
  isArchived: boolean;
}

export interface ClauseJuridique {
  id: string;
  numero: number;
  titre?: string | null;
  texte: string;
}

export interface DocumentJuridiqueDetail extends DocumentJuridiqueResume {
  clauses: ClauseJuridique[];
  motifRefus: string | null;
}

export const PREFIXE_DOCUMENT = 'legal-document:';

export const STATUTS_DEMANDE: Record<StatutDemande, { libelle: string; variante: 'succes' | 'attention' | 'danger' | 'info' | 'neutre' }> = {
  PENDING: { libelle: 'En attente', variante: 'attention' },
  IN_PROGRESS: { libelle: 'En revue', variante: 'info' },
  NEEDS_CORRECTION: { libelle: 'Corrections demandées', variante: 'attention' },
  APPROVED: { libelle: 'Approuvé', variante: 'succes' },
  REJECTED: { libelle: 'Refusé', variante: 'danger' },
};

export const TYPES_JURIDIQUES: Record<string, string> = {
  STATUTS: 'Statuts',
  CONTRAT: 'Contrat de prestation',
  NDA: 'Accord de confidentialité (NDA)',
  PV: "Procès-verbal d'assemblée",
};

export const STATUTS_JURIDIQUES: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EN_VALIDATION: 'En validation',
  VALIDE: 'Validé',
  REFUSE: 'Refusé',
  SIGNE: 'Signé',
};

export function nomAvocat(a: Pick<Avocat, 'first_name' | 'last_name' | 'username'>): string {
  const nom = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim();
  return `Maître ${nom || a.username}`;
}

export function initiales(texte: string): string {
  const mots = texte.replace(/^Maître\s+/, '').trim().split(/\s+/).filter(Boolean);
  return ((mots[0]?.[0] ?? '') + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase() || '?';
}

/** Une demande refusée avant d'être acceptée (PENDING → REJECTED) n'a pas été revue. */
export function libelleStatutDemande(d: DemandeRevue): string {
  if (d.status === 'REJECTED') {
    const refus = [...d.history].reverse().find((h) => h.newStatus === 'REJECTED');
    return refus?.oldStatus === 'PENDING' ? 'Demande refusée' : 'Document rejeté';
  }
  return STATUTS_DEMANDE[d.status].libelle;
}

export function idDocument(d: Pick<DemandeRevue, 'documentUrl'>): string | null {
  return d.documentUrl?.startsWith(PREFIXE_DOCUMENT) ? d.documentUrl.slice(PREFIXE_DOCUMENT.length) : null;
}
