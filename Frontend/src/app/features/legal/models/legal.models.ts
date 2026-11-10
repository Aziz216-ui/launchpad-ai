/** Contrat JSON du Legal-Service (préfixe /api/legal, via l'API Gateway). */

export type TypeDocumentJuridique = 'STATUTS' | 'CONTRAT' | 'NDA' | 'PV';
export type StatutDocumentJuridique = 'BROUILLON' | 'EN_VALIDATION' | 'VALIDE' | 'REFUSE' | 'SIGNE';

export interface Clause {
  id: string;
  numero: number;
  titre?: string | null;
  texte: string;
  documentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Commentaire {
  id: string;
  auteur: string;
  texte: string;
  date: string;
  documentId: string;
}

export interface DocumentJuridique {
  id: string;
  titre: string;
  projetId: string;
  type: TypeDocumentJuridique;
  statut: StatutDocumentJuridique;
  version: number;
  isArchived: boolean;
  archivedAt: string | null;
  motifRefus: string | null;
  clientId: string | null;
  signataires: string[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentJuridique {
  clauses: Clause[];
  commentaires: Commentaire[];
}

export interface StatutSignature {
  documentId: string;
  statut: StatutDocumentJuridique;
  isSigne: boolean;
  signataires: string[];
  version: number;
  signedAt: string | null;
}

export interface FiltresDocuments {
  projetId?: string | null;
  type?: TypeDocumentJuridique | null;
  statut?: StatutDocumentJuridique | null;
}

// --- Libellés et formulaires ------------------------------------------------------------------

export const STATUTS_JURIDIQUES: { statut: StatutDocumentJuridique; libelle: string }[] = [
  { statut: 'BROUILLON', libelle: 'Brouillon' },
  { statut: 'EN_VALIDATION', libelle: 'En validation' },
  { statut: 'VALIDE', libelle: 'Validé' },
  { statut: 'REFUSE', libelle: 'Refusé' },
  { statut: 'SIGNE', libelle: 'Signé' },
];

export type TypeChamp = 'texte' | 'nombre' | 'date' | 'zone' | 'liste' | 'choix';

export interface ChampParametre {
  cle: string;
  libelle: string;
  type: TypeChamp;
  aide?: string;
  choix?: string[];
  suffixe?: string;
  obligatoire?: boolean;
}

export interface ModeleDocument {
  type: TypeDocumentJuridique;
  libelle: string;
  description: string;
  champs: ChampParametre[];
}

/** Champs du formulaire de création, par type (params de POST /documents/generate). */
export const MODELES: ModeleDocument[] = [
  {
    type: 'STATUTS',
    libelle: 'Statuts',
    description: 'Statuts constitutifs de votre société : forme, capital, siège, objet, dirigeant.',
    champs: [
      { cle: 'denomination', libelle: 'Dénomination sociale', type: 'texte', obligatoire: true },
      { cle: 'forme', libelle: 'Forme juridique', type: 'choix', choix: ['SAS', 'SASU', 'SARL', 'EURL', 'SA'], obligatoire: true },
      { cle: 'capital', libelle: 'Capital social', type: 'nombre', suffixe: '€', obligatoire: true },
      { cle: 'siegeSocial', libelle: 'Siège social', type: 'texte', obligatoire: true },
      { cle: 'objetSocial', libelle: 'Objet social', type: 'zone', obligatoire: true },
      { cle: 'dirigeant', libelle: 'Dirigeant (Président / Gérant)', type: 'texte', obligatoire: true },
      { cle: 'duree', libelle: 'Durée de la société', type: 'nombre', suffixe: 'ans', aide: '99 ans au maximum' },
      { cle: 'associes', libelle: 'Associés', type: 'liste', aide: 'Un associé par ligne' },
    ],
  },
  {
    type: 'CONTRAT',
    libelle: 'Contrat de prestation',
    description: 'Contrat entre un prestataire et un client : objet, montant, délai.',
    champs: [
      { cle: 'prestataire', libelle: 'Prestataire', type: 'texte', obligatoire: true },
      { cle: 'client', libelle: 'Client', type: 'texte', obligatoire: true },
      { cle: 'objet', libelle: 'Objet de la prestation', type: 'zone', obligatoire: true },
      { cle: 'montant', libelle: 'Montant', type: 'nombre', suffixe: '€ HT', obligatoire: true },
      { cle: 'delai', libelle: "Délai d'exécution", type: 'texte', aide: 'Ex. : 3 mois', obligatoire: true },
    ],
  },
  {
    type: 'NDA',
    libelle: 'Accord de confidentialité (NDA)',
    description: 'Protège les informations échangées entre deux parties.',
    champs: [
      { cle: 'partieA', libelle: 'Partie émettrice', type: 'texte', obligatoire: true },
      { cle: 'partieB', libelle: 'Partie réceptrice', type: 'texte', obligatoire: true },
      { cle: 'objet', libelle: 'Objet des échanges', type: 'zone', obligatoire: true },
      { cle: 'dureeMois', libelle: 'Durée de confidentialité', type: 'nombre', suffixe: 'mois', obligatoire: true },
    ],
  },
  {
    type: 'PV',
    libelle: "Procès-verbal d'assemblée",
    description: "Compte rendu d'une assemblée : type, date, président, ordre du jour.",
    champs: [
      { cle: 'assembleeType', libelle: "Type d'assemblée", type: 'choix', choix: ['Générale Ordinaire', 'Générale Extraordinaire', 'Mixte'], obligatoire: true },
      { cle: 'dateSeance', libelle: 'Date de la séance', type: 'date', obligatoire: true },
      { cle: 'president', libelle: 'Président de séance', type: 'texte', obligatoire: true },
      { cle: 'ordreDuJour', libelle: 'Ordre du jour', type: 'zone', obligatoire: true },
    ],
  },
];

export function libelleType(type: TypeDocumentJuridique): string {
  return MODELES.find((m) => m.type === type)?.libelle ?? type;
}

export function libelleStatut(statut: StatutDocumentJuridique): string {
  return STATUTS_JURIDIQUES.find((s) => s.statut === statut)?.libelle ?? statut;
}

/** Variante de badge (shared/components/badge) par statut. */
export function varianteStatut(statut: StatutDocumentJuridique): 'succes' | 'attention' | 'danger' | 'info' | 'neutre' {
  return ({ BROUILLON: 'neutre', EN_VALIDATION: 'attention', VALIDE: 'succes', REFUSE: 'danger', SIGNE: 'info' } as const)[statut];
}

/** Libellé d'un paramètre enregistré dans metadata (tous types confondus). */
export function libelleParametre(cle: string, type?: TypeDocumentJuridique): string {
  // D'abord le libellé du type du document (« objet » n'a pas le même sens pour un NDA et un contrat)
  const propre = MODELES.find((m) => m.type === type)?.champs.find((c) => c.cle === cle);
  if (propre) return propre.libelle;
  for (const m of MODELES) {
    const champ = m.champs.find((c) => c.cle === cle);
    if (champ) return champ.libelle;
  }
  return cle;
}
