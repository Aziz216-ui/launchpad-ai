import { Injectable } from '@angular/core';

const CLE_TOKEN = 'launchpad.token';

/**
 * Stockage du token JWT.
 *
 * Le User-Service n'existe pas encore : aucun token n'est enregistré pour le moment.
 * Quand l'authentification sera prête, la page de connexion appellera `enregistrer()`
 * et l'intercepteur ajoutera automatiquement l'en-tête Authorization.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  lire(): string | null {
    try {
      return localStorage.getItem(CLE_TOKEN);
    } catch {
      return null;
    }
  }

  enregistrer(token: string): void {
    try {
      localStorage.setItem(CLE_TOKEN, token);
    } catch {
      // Stockage indisponible (navigation privée) : le token ne sera pas conservé.
    }
  }

  effacer(): void {
    try {
      localStorage.removeItem(CLE_TOKEN);
    } catch {
      // ignoré
    }
  }
}
