import { HttpErrorResponse } from '@angular/common/http';

/**
 * Erreur d'API normalisée.
 *
 * Django REST Framework renvoie soit {"detail": "..."}, soit un message par champ
 * ({"part_de_marche": ["..."]}) : `erreursChamps` permet d'afficher ces derniers
 * sous les champs des formulaires.
 */
export class ApiError extends Error {
  constructor(
    readonly statut: number,
    message: string,
    readonly erreursChamps: Record<string, string[]> = {},
  ) {
    super(message);
  }

  static depuis(reponse: HttpErrorResponse): ApiError {
    if (reponse.status === 0) {
      return new ApiError(0, 'Impossible de joindre le serveur. Vérifiez que le service est démarré.');
    }

    const corps = reponse.error;
    const erreursChamps: Record<string, string[]> = {};
    let message = messageParDefaut(reponse.status);

    if (corps && typeof corps === 'object' && !(corps instanceof Blob)) {
      for (const [cle, valeur] of Object.entries(corps)) {
        const messages = Array.isArray(valeur) ? valeur.map(String) : [String(valeur)];
        if (cle === 'detail' || cle === 'non_field_errors') {
          message = messages.join(' ');
        } else {
          erreursChamps[cle] = messages;
        }
      }
      if (Object.keys(erreursChamps).length && reponse.status === 400) {
        message = 'Certains champs sont invalides. Corrigez-les puis réessayez.';
      }
    }
    return new ApiError(reponse.status, message, erreursChamps);
  }
}

function messageParDefaut(statut: number): string {
  if (statut === 404) return "L'élément demandé est introuvable.";
  if (statut === 400) return 'La requête est invalide.';
  if (statut === 401 || statut === 403) return "Vous n'êtes pas autorisé à effectuer cette action.";
  if (statut >= 500) return 'Le serveur a rencontré une erreur. Réessayez dans un instant.';
  return 'Une erreur inattendue est survenue.';
}
