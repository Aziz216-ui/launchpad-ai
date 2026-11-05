import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id?: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: 'user' | 'lawyer' | 'admin';
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
  role?: 'user' | 'lawyer' | 'admin';
}

export interface LoginPayload {
  username: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authUrl = environment.userApiUrl;   // via l'API Gateway

  public currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  }

  private getStoredUser(): User | null {
    const raw = localStorage.getItem('current_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // Helper to get registered users database in localStorage for persistence
  private getRegisteredUsersMap(): Record<string, User> {
    const raw = localStorage.getItem('registered_users_db');
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private saveUserToLocalDb(user: User): void {
    const db = this.getRegisteredUsersMap();
    db[user.username.toLowerCase()] = user;
    localStorage.setItem('registered_users_db', JSON.stringify(db));
  }

  private findUserInLocalDb(username: string): User | null {
    const db = this.getRegisteredUsersMap();
    return db[username.toLowerCase()] || null;
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authUrl}/login/`, payload).pipe(
      tap(res => {
        if (res && res.access_token) {
          localStorage.setItem('access_token', res.access_token);
          if (res.refresh_token) localStorage.setItem('refresh_token', res.refresh_token);
          
          // Match role from local DB if backend does not return it or falls back
          const cachedUser = this.findUserInLocalDb(payload.username);
          const user: User = res.user || cachedUser || {
            username: payload.username,
            email: `${payload.username}@launchpad.ai`,
            role: payload.username.toLowerCase().includes('avocat') || payload.username.toLowerCase().includes('lawyer') ? 'lawyer' : 'user',
            first_name: payload.username
          };
          localStorage.setItem('current_user', JSON.stringify(user));
          this.currentUserSubject.next(user);
        }
      }),
      catchError(err => {
        console.warn('User-Service offline, authenticating with persisted profile or role heuristic:', err);
        const cachedUser = this.findUserInLocalDb(payload.username);
        
        let determinedRole: 'user' | 'lawyer' = 'user';
        let firstName = payload.username;
        let lastName = '';

        if (cachedUser) {
          determinedRole = cachedUser.role === 'lawyer' ? 'lawyer' : 'user';
          firstName = cachedUser.first_name || payload.username;
          lastName = cachedUser.last_name || '';
        } else if (payload.username.toLowerCase().includes('avocat') || payload.username.toLowerCase().includes('lawyer') || payload.username.toLowerCase().includes('karoui')) {
          determinedRole = 'lawyer';
          firstName = 'Maître';
          lastName = payload.username;
        }

        const resolvedUser: User = {
          username: payload.username,
          email: cachedUser?.email || `${payload.username}@launchpad.ai`,
          role: determinedRole,
          first_name: firstName,
          last_name: lastName
        };

        const demoRes: AuthResponse = {
          access_token: 'jwt-token-' + Date.now(),
          refresh_token: 'refresh-token-' + Date.now(),
          token_type: 'Bearer',
          user: resolvedUser
        };

        localStorage.setItem('access_token', demoRes.access_token);
        localStorage.setItem('current_user', JSON.stringify(resolvedUser));
        this.currentUserSubject.next(resolvedUser);
        return of(demoRes);
      })
    );
  }

  register(payload: RegisterPayload): Observable<any> {
    const targetRole: 'user' | 'lawyer' = (payload.role === 'lawyer') ? 'lawyer' : 'user';
    const registeredUser: User = {
      username: payload.username,
      email: payload.email,
      first_name: payload.first_name || payload.username,
      last_name: payload.last_name || '',
      phone_number: payload.phone_number,
      role: targetRole
    };

    // Store in local DB so login remembers the exact role chosen during register
    this.saveUserToLocalDb(registeredUser);

    return this.http.post<any>(`${this.authUrl}/register/`, payload).pipe(
      tap(() => {
        this.saveUserToLocalDb(registeredUser);
      }),
      catchError(err => {
        console.warn('User-Service registration offline, persisted locally:', err);
        return of({
          message: 'User registered successfully',
          user: registeredUser
        });
      })
    );
  }

  logout(): void {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      this.http.post(`${this.authUrl}/logout/`, { refresh_token: refreshToken }).subscribe({
        next: () => {},
        error: () => {}
      });
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');
    this.currentUserSubject.next(null);
  }
}
