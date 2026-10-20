/**
 * Interfaces TypeScript du Market-Service, écrites d'après le schéma OpenAPI
 * (GET /api/market/schema/). Les décimaux sont renvoyés en nombres JSON.
 */

export type StatutEtude = 'brouillon' | 'finalisee';
export type ImpactTendance = 'positif' | 'negatif' | 'neutre';
export type TypeSwot = 'force' | 'faiblesse' | 'opportunite' | 'menace';
export type NiveauConcurrence = 'inconnu' | 'faible' | 'moyen' | 'eleve';
export type PositionnementPrix = 'inconnu' | 'economique' | 'aligne' | 'premium';
export type NiveauPotentiel = 'faible' | 'moyen' | 'fort';
export type SourceOpportuniteMenace = 'tendance' | 'concurrence' | 'croissance' | 'prix';

export interface Secteur {
  id: number;
  nom: string;
  description: string;
  date_creation: string;
}

export interface Concurrent {
  id: number;
  nom: string;
  secteur: number;
  secteur_nom: string;
  site_web: string;
  description: string;
  forces: string;
  faiblesses: string;
  prix_moyen: number;
  part_de_marche: number;
  pays: string;
  date_creation: string;
}

/** Champs modifiables d'un concurrent (POST / PATCH /concurrents/). */
export type ConcurrentSaisie = Partial<
  Pick<
    Concurrent,
    'nom' | 'secteur' | 'site_web' | 'description' | 'forces' | 'faiblesses' | 'prix_moyen' | 'part_de_marche' | 'pays'
  >
>;

export interface Tendance {
  id: number;
  titre: string;
  secteur: number;
  secteur_nom: string;
  description: string;
  impact: ImpactTendance;
  date_creation: string;
}

export interface Persona {
  id: number;
  etude: number;
  nom: string;
  tranche_age: string;
  profession: string;
  localisation: string;
  revenu_estime: number | null;
  besoins: string;
  frustrations: string;
  comportement_achat: string;
  date_creation: string;
}

export type PersonaSaisie = Omit<Persona, 'id' | 'date_creation'>;

export interface ElementSwot {
  id: number;
  etude: number;
  type: TypeSwot;
  description: string;
  /** true : créé par « Générer la SWOT » (remplacé à chaque génération). */
  genere_automatiquement: boolean;
  date_creation: string;
}

export type ElementSwotSaisie = Pick<ElementSwot, 'etude' | 'type' | 'description'>;

/** Étude telle que renvoyée par la liste, la création et la modification. */
export interface EtudeMarche {
  id: number;
  projet_id: number;
  entrepreneur_id: number | null;
  statut: StatutEtude;
  secteur: number;
  secteur_nom: string;
  titre: string;
  taille_marche: number;
  taux_croissance: number;
  cible: string;
  zone_geographique: string;
  hypotheses: string;
  description_offre: string;
  prix_propose: number | null;
  /** IDs des concurrents associés à l'étude. */
  concurrents: number[];
  /** IDs des tendances associées à l'étude. */
  tendances: number[];
  date_creation: string;
  date_mise_a_jour: string;
}

/** Détail d'une étude (GET /etudes/<id>/). */
export interface EtudeMarcheDetail extends EtudeMarche {
  concurrents_details: Concurrent[];
  tendances_details: Tendance[];
  personas: Persona[];
  swot: ElementSwot[];
}

/** Champs envoyés en création / modification (le statut se change via /finaliser/). */
export type EtudeSaisie = Partial<
  Pick<
    EtudeMarche,
    | 'projet_id'
    | 'entrepreneur_id'
    | 'secteur'
    | 'titre'
    | 'taille_marche'
    | 'taux_croissance'
    | 'cible'
    | 'zone_geographique'
    | 'hypotheses'
    | 'description_offre'
    | 'prix_propose'
    | 'concurrents'
    | 'tendances'
  >
>;

export interface ConcurrentResume {
  id: number;
  nom: string;
  pays: string;
  prix_moyen: number;
  part_de_marche: number;
}

export interface ComparaisonPrix {
  etude_id: number;
  prix_propose: number | null;
  nombre_concurrents: number;
  prix_min: number | null;
  prix_moyen: number | null;
  prix_max: number | null;
  ecart_moyenne_pct: number | null;
  positionnement: PositionnementPrix;
  /** Triés par prix croissant. */
  concurrents: ConcurrentResume[];
}

export interface ElementOpportuniteMenace {
  source: SourceOpportuniteMenace;
  description: string;
}

export interface OpportunitesMenaces {
  etude_id: number;
  niveau_concurrence: NiveauConcurrence;
  taux_croissance: number;
  positionnement_prix: PositionnementPrix;
  opportunites: ElementOpportuniteMenace[];
  menaces: ElementOpportuniteMenace[];
}

export interface GenererSwotReponse {
  generes: number;
  conserves: number;
  swot: ElementSwot[];
}

export interface ElementSwotRapport {
  type: TypeSwot;
  description: string;
  genere_automatiquement: boolean;
}

export interface PotentielCommercial {
  niveau: NiveauPotentiel;
  score: number;
  score_max: number;
  justification: string[];
  conclusion: string;
}

export interface RapportEtude {
  etude: {
    id: number;
    titre: string;
    projet_id: number;
    entrepreneur_id: number | null;
    statut: StatutEtude;
    date_creation: string;
    date_mise_a_jour: string;
  };
  marche_cible: {
    secteur: { id: number; nom: string };
    cible: string;
    zone_geographique: string;
    taille_marche: number;
    taux_croissance: number;
  };
  hypotheses: string;
  offre: { description: string; prix_propose: number | null };
  tendances: { id: number; titre: string; impact: ImpactTendance; description: string }[];
  concurrents: (ConcurrentResume & { site_web: string; forces: string; faiblesses: string })[];
  comparaison_prix: ComparaisonPrix;
  personas: Omit<Persona, 'etude' | 'date_creation'>[];
  opportunites_menaces: { opportunites: ElementOpportuniteMenace[]; menaces: ElementOpportuniteMenace[] };
  swot: {
    source: 'enregistree' | 'calculee';
    forces: ElementSwotRapport[];
    faiblesses: ElementSwotRapport[];
    opportunites: ElementSwotRapport[];
    menaces: ElementSwotRapport[];
  };
  niveau_concurrence: NiveauConcurrence;
  potentiel_commercial: PotentielCommercial;
}
