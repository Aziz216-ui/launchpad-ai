import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from '../auth/token.service';

/** Rôles Keycloak unifiés (voir Backend/User-Service/setup_keycloak.py). */
export type Role = 'LAWYER' | 'ADMIN' | 'ENTREPRENEUR' | 'ACCOUNTANT' | 'FINANCIER';

export interface User {
  id?: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: Role;
  phone_number?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
  user?: User;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  role?: Role;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface LoginPayload {
  username: string;
  password: string;
}

const CLE_UTILISATEUR = 'launchpad.current_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authUrl = environment.userApiUrl; // via l'API Gateway

  public currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private tokenService: TokenService) {}

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public isAuthenticated(): boolean {
    return !!this.tokenService.lire();
  }

  private getStoredUser(): User | null {
    try {
      const raw = localStorage.getItem(CLE_UTILISATEUR);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private setStoredUser(user: User | null): void {
    try {
      if (user) {
        localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(user));
      } else {
        localStorage.removeItem(CLE_UTILISATEUR);
      }
    } catch {
      // Stockage indisponible (navigation privée) : l'utilisateur reste connu pour la session en cours.
    }
    this.currentUserSubject.next(user);
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authUrl}/login/`, payload).pipe(
      tap((res) => {
        if (res?.access_token) {
          this.tokenService.enregistrer(res.access_token);
          if (res.refresh_token) {
            this.tokenService.enregistrerRefresh(res.refresh_token);
          }
          this.setStoredUser(res.user ?? null);
        }
      }),
    );
  }

  register(payload: RegisterPayload): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.authUrl}/register/`, payload);
  }

  logout(): void {
    const refreshToken = this.tokenService.lireRefresh();
    if (refreshToken) {
      this.http.post(`${this.authUrl}/logout/`, { refresh_token: refreshToken }).subscribe({
        next: () => {},
        error: () => {},
      });
    }
    this.tokenService.effacer();
    this.setStoredUser(null);
  }
}
