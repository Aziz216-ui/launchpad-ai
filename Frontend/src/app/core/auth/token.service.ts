import { Injectable } from '@angular/core';

const CLE_TOKEN = 'launchpad.token';

/**
 * Stockage du token JWT.
 *
 * Le User-Service n'existe pas encore : aucun token n'est enregistr├⌐ pour le moment.
 * Quand l'authentification sera pr├¬te, la page de connexion appellera `enregistrer()`
 * et l'intercepteur ajoutera automatiquement l'en-t├¬te Authorization.
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
      // Stockage indisponible (navigation priv├⌐e) : le token ne sera pas conserv├⌐.
    }
  }

  effacer(): void {
    try {
      localStorage.removeItem(CLE_TOKEN);
    } catch {
      // ignor├⌐
    }
  }
}
