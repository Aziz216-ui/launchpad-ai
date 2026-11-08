import { Role } from '../services/auth.service';

/**
 * Route « chez soi » pour chaque rôle : cible de la redirection après connexion, et
 * route vers laquelle roleGuard renvoie un utilisateur qui tente d'accéder à l'espace
 * d'un autre rôle.
 *
 * ACCOUNTANT -> Comptabilité (Professional-Service), LAWYER -> espace avocat,
 * ENTREPRENEUR -> tableau de bord (bundle fondateur : marché, finance, IA, juridique),
 * FINANCIER -> module Finance (pensé pour un seul projet, pas de vue dédiée financier
 * distincte de la vue entrepreneur), ADMIN -> pas d'espace dédié pour l'instant, même
 * bundle que ENTREPRENEUR.
 */
const ROUTE_PAR_ROLE: Record<Role, string> = {
  LAWYER: '/professional/avocat',
  ACCOUNTANT: '/professional/comptabilite',
  ENTREPRENEUR: '/tableau-de-bord',
  FINANCIER: '/finance',
  ADMIN: '/tableau-de-bord',
};

const ROUTE_PAR_DEFAUT = '/tableau-de-bord';

export function routeParDefaut(role: Role | null | undefined): string {
  return role ? ROUTE_PAR_ROLE[role] ?? ROUTE_PAR_DEFAUT : ROUTE_PAR_DEFAUT;
}
