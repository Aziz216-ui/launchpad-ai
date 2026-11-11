import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, catchError, filter, forkJoin, of, timer } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TokenService } from '../auth/token.service';
import { SANS_TOAST_ERREUR } from '../http/api.interceptor';
import { AuthService } from '../services/auth.service';

/** Notification affichée sous la cloche : un message non lu d'un dossier comptable. */
export interface Notification {
  id: string;
  automatique: boolean;
  /** ACCOUNTANT / ENTREPRENEUR : auteur du message. */
  roleAuteur: string;
  contenu: string;
  creeLe: string;
  dossier: { id: string; reference: string; startupName: string };
  /** Page à ouvrir au clic. */
  lien: string[];
}

interface MessageNonLu {
  id: string;
  senderRole: string;
  content: string;
  automatic: boolean;
  createdAt: string;
  file: { id: string; reference: string; startupName: string };
}

const INTERVALLE_MS = 30_000;
const ROLES_CONCERNES = ['ENTREPRENEUR', 'ACCOUNTANT'];

/**
 * Centre de notifications de la cloche (en-tête) : messages non lus de l'utilisateur dans ses dossiers
 * comptables, y compris les notifications automatiques (document validé / rejeté).
 * Source : GET /api/comptable/messages/unread (message-service). Interrogé toutes les 30 s, à chaque
 * changement de page et au retour sur l'onglet ; en arrière-plan, sans toast en cas d'erreur.
 */
@Injectable({ providedIn: 'root' })
export class CentreNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenService);
  private readonly auth = inject(AuthService);
  private readonly url = `${environment.professionalApiUrl}/messages`;
  private readonly fond = { context: new HttpContext().set(SANS_TOAST_ERREUR, true) };
  private abonnement: Subscription | null = null;

  readonly elements = signal<Notification[]>([]);
  readonly total = signal(0);
  readonly chargement = signal(false);
  readonly erreur = signal(false);
  readonly libelleTotal = computed(() => (this.total() > 99 ? '99+' : String(this.total())));

  /** À appeler une fois par l'en-tête : démarre l'interrogation périodique. */
  demarrer(destroyRef: DestroyRef, router: Router): void {
    if (this.abonnement) return;
    this.abonnement = timer(0, INTERVALLE_MS).subscribe(() => this.rafraichir());
    const navigation = router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.rafraichir());
    const visible = () => document.visibilityState === 'visible' && this.rafraichir();
    document.addEventListener('visibilitychange', visible);
    destroyRef.onDestroy(() => {
      this.abonnement?.unsubscribe();
      this.abonnement = null;
      navigation.unsubscribe();
      document.removeEventListener('visibilitychange', visible);
    });
  }

  rafraichir(): void {
    if (!this.concerne() || document.visibilityState === 'hidden') {
      if (!this.concerne()) this.vider();
      return;
    }
    this.chargement.set(true);
    const params = new HttpParams().set('limit', 20);
    this.http.get<{ data: MessageNonLu[]; meta: { total: number } }>(`${this.url}/unread`, { params, ...this.fond }).subscribe({
      next: (r) => {
        this.elements.set(r.data.map(versNotification));
        this.total.set(r.meta.total);
        this.erreur.set(false);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      },
    });
  }

  /** Marque une notification comme lue (mise à jour immédiate de la cloche). */
  marquerLue(notification: Notification): void {
    this.retirer([notification.id]);
    this.http.post(`${this.url}/${notification.id}/read`, {}, this.fond).pipe(catchError(() => of(null))).subscribe();
  }

  toutMarquerLu(): void {
    const ids = this.elements().map((n) => n.id);
    if (!ids.length) return;
    this.retirer(ids);
    forkJoin(ids.map((id) => this.http.post(`${this.url}/${id}/read`, {}, this.fond).pipe(catchError(() => of(null))))).subscribe(
      () => this.rafraichir(),
    );
  }

  private retirer(ids: string[]): void {
    const set = new Set(ids);
    const restants = this.elements().filter((n) => !set.has(n.id));
    this.total.update((t) => Math.max(0, t - (this.elements().length - restants.length)));
    this.elements.set(restants);
  }

  private vider(): void {
    this.elements.set([]);
    this.total.set(0);
  }

  private concerne(): boolean {
    const role = this.auth.currentUserValue?.role;
    return !!this.tokens.lire() && !!role && ROLES_CONCERNES.includes(role);
  }
}

function versNotification(m: MessageNonLu): Notification {
  return {
    id: m.id,
    automatique: m.automatic,
    roleAuteur: m.senderRole,
    contenu: m.content,
    creeLe: m.createdAt,
    dossier: m.file,
    lien: ['/professional/comptabilite/dossiers', m.file.id],
  };
}
