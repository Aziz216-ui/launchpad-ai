import { Role } from '../core/services/auth.service';
import { NomIcone } from '../shared/components/icon.component';

export interface ElementMenu {
  /** Texte affiché dans la barre latérale. */
  libelle: string;
  /** Route du module, déclarée dans app.routes.ts. */
  route: string;
  /** Nom d'une icône de shared/components/icon.component.ts. */
  icone: NomIcone;
  /** Rôles autorisés à voir ce lien ; absent = visible pour tous les rôles connectés. */
  roles?: Role[];
}

/**
 * Modules affichés dans la barre latérale, dans l'ordre des maquettes.
 * Ajouter un module = ajouter une ligne ici (et sa route lazy dans app.routes.ts).
 * `roles` doit rester cohérent avec les canActivate posés dans les fichiers de routes des
 * modules (professional.routes.ts, finance.routes.ts) : un lien visible qui mène à un
 * roleGuard qui refuse l'accès serait un bug.
 */
export const MENU: ElementMenu[] = [
  { libelle: 'Tableau de bord', route: '/tableau-de-bord', icone: 'tableau-de-bord', roles: ['ENTREPRENEUR', 'ADMIN'] },
  { libelle: 'Co-Fondateur IA', route: '/co-fondateur-ia', icone: 'etoile', roles: ['ENTREPRENEUR', 'ADMIN'] },
  { libelle: 'Étude de marché', route: '/etude-marche', icone: 'graphique', roles: ['ENTREPRENEUR', 'ADMIN'] },
  { libelle: 'Finance', route: '/finance', icone: 'carte', roles: ['ENTREPRENEUR', 'FINANCIER', 'ADMIN'] },
  { libelle: 'Juridique', route: '/juridique', icone: 'balance', roles: ['ENTREPRENEUR', 'ADMIN'] },
  { libelle: 'Comptabilité', route: '/professional/comptabilite', icone: 'calculatrice', roles: ['ACCOUNTANT', 'ENTREPRENEUR', 'ADMIN'] },
  { libelle: 'Avocat', route: '/professional/avocat', icone: 'mallette', roles: ['LAWYER', 'ENTREPRENEUR', 'ADMIN'] },
];
