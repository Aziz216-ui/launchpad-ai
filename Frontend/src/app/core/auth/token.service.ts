import { Injectable } from '@angular/core';

const CLE_TOKEN = 'launchpad.token';
const CLE_REFRESH = 'launchpad.refresh_token';

/**
 * Stockage du token JWT (et du refresh token). Seul endroit responsable de ces deux
 * valeurs : AuthService les écrit ici au login/logout, l'intercepteur HTTP les y lit
 * pour poser l'en-tête Authorization sur chaque requête.
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

  lireRefresh(): string | null {
    try {
      return localStorage.getItem(CLE_REFRESH);
    } catch {
      return null;
    }
  }

  enregistrerRefresh(token: string): void {
    try {
      localStorage.setItem(CLE_REFRESH, token);
    } catch {
      // ignoré
    }
  }

  effacer(): void {
    try {
      localStorage.removeItem(CLE_TOKEN);
      localStorage.removeItem(CLE_REFRESH);
    } catch {
      // ignoré
    }
  }
}
