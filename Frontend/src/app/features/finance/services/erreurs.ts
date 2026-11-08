import { ApiError } from '../../../core/http/api-error';
import { NotificationService } from '../../../core/notifications/notification.service';

/**
 * L'intercepteur affiche déjà un toast pour les erreurs réseau (0) et serveur (5xx, dont le 503 « IA indisponible »).
 * Les écrans n'affichent donc que les autres erreurs (400, 404…), et renvoient le message à afficher.
 */
export function messageErreur(erreur: unknown, notifications: NotificationService): string {
  const message = erreur instanceof Error ? erreur.message : 'Une erreur inattendue est survenue.';
  const dejaAffichee = erreur instanceof ApiError && (erreur.statut === 0 || erreur.statut >= 500);
  if (!dejaAffichee) {
    notifications.erreur(message);
  }
  return message;
}

/** Message d'une erreur, sans toast : pour les écrans qui l'affichent eux-mêmes (bandeau près du formulaire). */
export function texteErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : 'Une erreur inattendue est survenue.';
}

/** Erreurs par champ renvoyées par le backend (400 de validation), sinon objet vide. */
export function erreursChamps(erreur: unknown): Record<string, string[]> {
  return erreur instanceof ApiError ? erreur.erreursChamps : {};
}
