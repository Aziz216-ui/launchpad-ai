import { Injectable, signal } from '@angular/core';

export type TypeNotification = 'succes' | 'erreur' | 'info';

export interface Notification {
  id: number;
  type: TypeNotification;
  message: string;
}

/** Notifications éphémères (toasts) affichées en haut à droite de l'écran. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly _notifications = signal<Notification[]>([]);
  readonly notifications = this._notifications.asReadonly();
  private prochainId = 1;

  succes(message: string): void {
    this.afficher('succes', message);
  }

  erreur(message: string): void {
    this.afficher('erreur', message, 7000);
  }

  info(message: string): void {
    this.afficher('info', message);
  }

  fermer(id: number): void {
    this._notifications.update((liste) => liste.filter((n) => n.id !== id));
  }

  private afficher(type: TypeNotification, message: string, duree = 4500): void {
    const id = this.prochainId++;
    this._notifications.update((liste) => [...liste, { id, type, message }]);
    setTimeout(() => this.fermer(id), duree);
  }
}
