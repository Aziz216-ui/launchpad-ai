import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Erreur de POST /reset-password/ (message en français à afficher tel quel). */
export interface ErreurReinitialisation {
  error: string;
  code_erreur: 'code_invalide' | 'code_expire' | 'trop_essais' | 'mot_de_passe_faible' | 'champs_invalides';
}

/**
 * « Mot de passe oublié » par code (User-Service, routes publiques de la gateway) :
 * 1. POST /forgot-password/ : code à 6 chiffres envoyé par e-mail (valable 10 minutes) ; réponse
 *    toujours identique, que le compte existe ou non ;
 * 2. POST /reset-password/ : code + nouveau mot de passe, changé dans Keycloak.
 */
@Injectable({ providedIn: 'root' })
export class MotDePasseOublieService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.userApiUrl;

  demanderCode(identifiant: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.url}/forgot-password/`, { identifiant });
  }

  reinitialiser(identifiant: string, code: string, nouveauMotDePasse: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.url}/reset-password/`, {
      identifiant,
      code,
      nouveau_mot_de_passe: nouveauMotDePasse,
    });
  }
}
