import { NomIcone } from '../shared/components/icon.component';

export interface ElementMenu {
  /** Texte affich├⌐ dans la barre lat├⌐rale. */
  libelle: string;
  /** Route du module, d├⌐clar├⌐e dans app.routes.ts. */
  route: string;
  /** Nom d'une ic├┤ne de shared/components/icon.component.ts. */
  icone: NomIcone;
}

/**
 * Modules affich├⌐s dans la barre lat├⌐rale, dans l'ordre des maquettes.
 * Ajouter un module = ajouter une ligne ici (et sa route lazy dans app.routes.ts).
 */
export const MENU: ElementMenu[] = [
  { libelle: 'Tableau de bord', route: '/tableau-de-bord', icone: 'tableau-de-bord' },
  { libelle: 'Co-Fondateur IA', route: '/co-fondateur-ia', icone: 'etoile' },
  { libelle: '├ëtude de march├⌐', route: '/etude-marche', icone: 'graphique' },
  { libelle: 'Finance', route: '/finance', icone: 'carte' },
  { libelle: 'Juridique', route: '/juridique', icone: 'balance' },
  { libelle: 'Comptabilit├⌐', route: '/professional/comptabilite', icone: 'calculatrice' },
  { libelle: 'Avocat', route: '/professional/avocat', icone: 'mallette' },
];
