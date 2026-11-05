/**
 * Interfaces TypeScript des microservices du march├⌐ (via l'API Gateway), ├⌐crites d'apr├¿s
 * leurs sch├⌐mas OpenAPI (/api/market/<ressource>/schema/). Les d├⌐cimaux sont des nombres JSON.
 *
 * Les relations entre services sont des identifiants : le backend accepte toujours
 * secteur, concurrents, tendances et etude, et renvoie en plus secteur_id, concurrent_ids,
 * tendance_ids et etude_id. secteur_id / secteur_nom valent null si le secteur a ├⌐t├⌐ supprim├⌐.
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
  secteur: number | null;
  secteur_id: number | null;
  /** null si le secteur a ├⌐t├⌐ supprim├⌐ (afficher ┬½ Secteur supprim├⌐ ┬╗). */
  secteur_nom: string | null;
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
  secteur_id: number;
  secteur_nom: string;
  description: string;
  impact: ImpactTendance;
  date_creation: string;
}

export interface Persona {
  id: number;
  etude: number;
  etude_id: number;
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

export type PersonaSaisie = Omit<Persona, 'id' | 'etude_id' | 'date_creation'>;

export interface ElementSwot {
  id: number;
  etude: number;
  etude_id: number;
  type: TypeSwot;
  description: string;
  /** true : cr├⌐├⌐ par ┬½ G├⌐n├⌐rer la SWOT ┬╗ (remplac├⌐ ├á chaque g├⌐n├⌐ration). */
  genere_automatiquement: boolean;
  date_creation: string;
}

export type ElementSwotSaisie = Pick<ElementSwot, 'etude' | 'type' | 'description'>;

/** ├ëtude telle que renvoy├⌐e par la liste, la cr├⌐ation et la modification. */
export interface EtudeMarche {
  id: number;
  projet_id: number;
  entrepreneur_id: number | null;
  statut: StatutEtude;
  secteur: number | null;
  secteur_id: number | null;
  /** null si le secteur a ├⌐t├⌐ supprim├⌐ (afficher ┬½ Secteur supprim├⌐ ┬╗). */
  secteur_nom: string | null;
  titre: string;
  taille_marche: number;
  taux_croissance: number;
  cible: string;
  zone_geographique: string;
  hypotheses: string;
  description_offre: string;
  prix_propose: number | null;
  /** IDs des concurrents associ├⌐s ├á l'├⌐tude (identique ├á concurrent_ids). */
  concurrents: number[];
  concurrent_ids: number[];
  /** IDs des tendances associ├⌐es ├á l'├⌐tude (identique ├á tendance_ids). */
  tendances: number[];
  tendance_ids: number[];
  date_creation: string;
  date_mise_a_jour: string;
}

/** D├⌐tail d'une ├⌐tude (GET /etudes/<id>/). */
export interface EtudeMarcheDetail extends EtudeMarche {
  concurrents_details: Concurrent[];
  tendances_details: Tendance[];
  personas: Persona[];
  swot: ElementSwot[];
}

/** Champs envoy├⌐s en cr├⌐ation / modification (le statut se change via /finaliser/). */
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
  /** Tri├⌐s par prix croissant. */
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
    secteur: { id: number | null; nom: string | null };
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
