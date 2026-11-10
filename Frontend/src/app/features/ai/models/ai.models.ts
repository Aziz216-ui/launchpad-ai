/**
 * Modèles TypeScript du module Co-Fondateur IA.
 * Correspondent aux réponses JSON des 3 microservices (Projet, Recommandation, Conversation)
 * exposés via l'API Gateway (port 8090, préfixe /api/ai/).
 */

// ─── Projet ──────────────────────────────────────────────────────────────────

export type StadeProjet = 'idee' | 'prototype' | 'lancement' | 'croissance';
export type StatutProjet = 'brouillon' | 'actif' | 'archive';

export interface Projet {
  id: number;
  entrepreneur_id: number;
  titre: string;
  idee: string;
  objectifs: string;
  /** Nom du secteur (affichage). Recopié par le Projet-Service depuis l'étude de marché choisie. */
  secteur: string;
  /** Id du secteur (secteur-service) : doit être celui d'une étude de marché du projet. */
  secteur_id: number | null;
  stade: StadeProjet;
  public_cible: string;
  budget_estime: number | null;
  statut: StatutProjet;
  date_creation: string;
  date_mise_a_jour: string;
}

export type ProjetSaisie = Omit<Projet, 'id' | 'entrepreneur_id' | 'statut' | 'date_creation' | 'date_mise_a_jour'>;

/** Secteur d'une étude de marché du projet (champ "secteurs" de /api/market/analyse/projet/{id}/). */
export interface SecteurEtude {
  id: number;
  nom: string;
}

export interface AnalyseProjet {
  id: number;
  projet_id: number;
  forces: string[];
  faiblesses: string[];
  score_global: number;
  resume: string;
  source: 'regles' | 'llm';
  date_creation: string;
}

// ─── Recommandation ──────────────────────────────────────────────────────────

export type CategorieReco = 'marche' | 'financier' | 'juridique' | 'produit' | 'equipe';
export type PrioriteReco = 'haute' | 'moyenne' | 'basse';
export type StatutReco = 'nouvelle' | 'appliquee' | 'ignoree';

export interface Recommandation {
  id: number;
  projet_id: number;
  analyse_id: number | null;
  categorie: CategorieReco;
  titre: string;
  description: string;
  priorite: PrioriteReco;
  ordre: number;
  statut: StatutReco;
  date_creation: string;
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface Conversation {
  id: number;
  projet_id: number;
  titre: string;
  date_creation: string;
  date_mise_a_jour: string;
}

export type RoleMessage = 'utilisateur' | 'assistant';

export interface Message {
  id: number;
  conversation_id: number;
  role: RoleMessage;
  contenu: string;
  date_creation: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

