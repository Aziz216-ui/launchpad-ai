import { NomIcone } from '../shared/components/icon.component';

export interface ElementMenu {
  /** Texte affiché dans la barre latérale. */
  libelle: string;
  /** Route du module, déclarée dans app.routes.ts. */
  route: string;
  /** Nom d'une icône de shared/components/icon.component.ts. */
  icone: NomIcone;
}

/**
 * Modules affichés dans la barre latérale, dans l'ordre des maquettes.
 * Ajouter un module = ajouter une ligne ici (et sa route lazy dans app.routes.ts).
 */
export const MENU: ElementMenu[] = [
  { libelle: 'Tableau de bord', route: '/tableau-de-bord', icone: 'tableau-de-bord' },
  { libelle: 'Co-Fondateur IA', route: '/co-fondateur-ia', icone: 'etoile' },
  { libelle: 'Étude de marché', route: '/etude-marche', icone: 'graphique' },
  { libelle: 'Finance', route: '/finance', icone: 'carte' },
  { libelle: 'Juridique', route: '/juridique', icone: 'balance' },
  { libelle: 'Comptabilité', route: '/professional/comptabilite', icone: 'calculatrice' },
  { libelle: 'Avocat', route: '/professional/avocat', icone: 'mallette' },
];
