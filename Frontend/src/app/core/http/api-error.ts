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

    // Services NestJS (juridique) : {"statusCode", "message": "…" | ["…", "…"], "error"}
    if (corps && typeof corps === 'object' && !(corps instanceof Blob) && typeof corps.statusCode === 'number' && corps.message) {
      const messages: string[] = (Array.isArray(corps.message) ? corps.message : [corps.message]).map(String);
      // class-validator ajoute un message technique anglais après le message métier : on garde le premier
      return new ApiError(reponse.status, messages.filter((m) => !/ must be | should not /.test(m))[0] ?? messages[0]);
    }

    // Services Symfony (espace comptable) : {"error": {"code", "message", "details": [{"field", "message"}]}}
    const erreurSymfony = corps && typeof corps === 'object' && !(corps instanceof Blob) ? corps.error : undefined;
    if (erreurSymfony && typeof erreurSymfony === 'object' && typeof erreurSymfony.message === 'string') {
      for (const detail of Array.isArray(erreurSymfony.details) ? erreurSymfony.details : []) {
        if (detail?.field) (erreursChamps[detail.field] ??= []).push(String(detail.message));
      }
      return new ApiError(reponse.status, erreurSymfony.message, erreursChamps);
    }

    if (corps && typeof corps === 'object' && !(corps instanceof Blob)) {
      for (const [cle, valeur] of Object.entries(corps)) {
        // Services Spring (ProblemDetail, RFC 7807) : les métadonnées ne sont pas des champs de formulaire,
        // et les erreurs de validation arrivent sous forme {"erreurs": {"champ": "message"}}.
        if (corps.detail !== undefined && METADONNEES_PROBLEME.has(cle)) continue;
        if (cle === 'erreurs' && valeur && typeof valeur === 'object' && !Array.isArray(valeur)) {
          for (const [champ, texte] of Object.entries(valeur)) erreursChamps[champ] = [String(texte)];
          continue;
        }
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

const METADONNEES_PROBLEME = new Set(['type', 'title', 'status', 'instance']);

function messageParDefaut(statut: number): string {
  if (statut === 404) return "L'élément demandé est introuvable.";
  if (statut === 400) return 'La requête est invalide.';
  if (statut === 401 || statut === 403) return "Vous n'êtes pas autorisé à effectuer cette action.";
  if (statut >= 500) return 'Le serveur a rencontré une erreur. Réessayez dans un instant.';
  return 'Une erreur inattendue est survenue.';
}
