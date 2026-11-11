/** Contrat JSON de l'espace comptable (Backend/Professional-Service, préfixe /api/comptable). */

export type StatutDossier = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'CLOSED';

/** Espace d'un comptable : une carte de l'annuaire « Demander un comptable ». */
export interface EspaceComptable {
  id: string;
  accountantId: string;
  displayName: string;
  acceptingClients: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Dossier comptable d'une startup (demande, puis suivi par le comptable). */
export interface DossierComptable {
  id: string;
  reference: string;
  status: StatutDossier;
  startupId: string | null;
  startupName: string;
  entrepreneurId: string;
  entrepreneurDisplayName: string | null;
  requestMessage: string | null;
  rejectionReason: string | null;
  workspace: { id: string; accountantId: string; displayName: string };
  decidedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetaPage {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Page<T> {
  data: T[];
  meta: MetaPage;
}

/** Corps de POST /files : demande de dossier envoyée au comptable choisi. */
export interface DemandeDossier {
  workspaceId: string;
  startupName: string;
  startupId?: string | null;
  requestMessage?: string | null;
}

export const STATUTS_DOSSIER: { statut: StatutDossier; libelle: string }[] = [
  { statut: 'PENDING', libelle: 'En attente' },
  { statut: 'ACTIVE', libelle: 'Actif' },
  { statut: 'REJECTED', libelle: 'Refusé' },
  { statut: 'CLOSED', libelle: 'Clôturé' },
];

// --- Détail d'un dossier : documents, messages, historiques ---------------------------------------

export type RoleActeur = 'ACCOUNTANT' | 'ENTREPRENEUR' | 'ADMIN';
export type StatutDocument = 'PENDING' | 'VALIDATED' | 'REJECTED';
export type TypeDocument =
  | 'BALANCE_SHEET'
  | 'INCOME_STATEMENT'
  | 'INVOICE'
  | 'BANK_STATEMENT'
  | 'FINANCIAL_FORECAST'
  | 'BUDGET'
  | 'TAX_RETURN'
  | 'PAYROLL'
  | 'REPORT'
  | 'OTHER';

/** Identité lue dans le jeton (GET /me) : sert à reconnaître « vous » dans les documents et messages. */
export interface Moi {
  id: string;
  displayName: string;
  roles: string[];
  workspaceId: string | null;
}

export interface DocumentComptable {
  id: string;
  clientFileId: string;
  title: string;
  type: TypeDocument;
  source: 'UPLOAD' | 'EXTERNAL';
  status: StatutDocument;
  versionNumber: number;
  previousVersionId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  file: { originalFilename: string; mimeType: string; size: number; downloadUrl: string } | null;
  external: { ref: string; service: string } | null;
  uploadedBy: string;
  uploadedByRole: RoleActeur;
  uploadedAt: string;
  updatedAt: string;
}

export interface ValidationDocument {
  id: string;
  decision: 'VALIDATED' | 'REJECTED';
  previousStatus: StatutDocument;
  revision: boolean;
  automatic: boolean;
  comment: string | null;
  accountantId: string;
  createdAt: string;
}

export interface MessageDossier {
  id: string;
  clientFileId: string;
  documentId: string | null;
  senderId: string;
  senderRole: RoleActeur;
  content: string;
  automatic: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface AffectationDossier {
  id: string;
  type: 'ACCEPTANCE' | 'ADMIN_ASSIGNMENT' | 'ADMIN_REASSIGNMENT';
  previousAccountantId: string | null;
  newAccountantId: string;
  assignedBy: string;
  reason: string | null;
  assignedAt: string;
}

/** Champs du dépôt (multipart) ; le fichier est ajouté à part. */
export interface DepotDocument {
  title: string;
  type: TypeDocument;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export const TYPES_DOCUMENT: { type: TypeDocument; libelle: string }[] = [
  { type: 'BALANCE_SHEET', libelle: 'Bilan' },
  { type: 'INCOME_STATEMENT', libelle: 'Compte de résultat' },
  { type: 'INVOICE', libelle: 'Facture' },
  { type: 'BANK_STATEMENT', libelle: 'Relevé bancaire' },
  { type: 'FINANCIAL_FORECAST', libelle: 'Prévisionnel' },
  { type: 'BUDGET', libelle: 'Budget' },
  { type: 'TAX_RETURN', libelle: 'Déclaration fiscale' },
  { type: 'PAYROLL', libelle: 'Paie' },
  { type: 'REPORT', libelle: 'Rapport' },
  { type: 'OTHER', libelle: 'Autre' },
];

export const STATUTS_DOCUMENT: { statut: StatutDocument; libelle: string }[] = [
  { statut: 'PENDING', libelle: 'À valider' },
  { statut: 'VALIDATED', libelle: 'Validé' },
  { statut: 'REJECTED', libelle: 'Rejeté' },
];

/** Extensions acceptées par document-service (DocumentService::ALLOWED_FILES), 10 Mo maximum. */
export const FICHIERS_ACCEPTES = '.pdf,.png,.jpg,.jpeg,.xlsx';
export const TAILLE_MAX_OCTETS = 10 * 1024 * 1024;
