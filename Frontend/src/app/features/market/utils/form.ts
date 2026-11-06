import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

import { ApiError } from '../../../core/http/api-error';
import { lireNombre } from './format';

/**
 * Valide un nombre saisi à la française ("24 000 000", "8,4").
 * Un champ vide est accepté : combiner avec Validators.required si besoin.
 */
export function nombreValidator(options: { min?: number; max?: number } = {}): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const valeur = lireNombre(controle.value);
    if (valeur === null) return null;
    if (Number.isNaN(valeur)) return { nombre: true };
    if (options.min !== undefined && valeur < options.min) return { min: { min: options.min } };
    if (options.max !== undefined && valeur > options.max) return { max: { max: options.max } };
    return null;
  };
}

/**
 * Reporte les erreurs 400 de l'API sous les champs correspondants.
 * Renvoie true si au moins une erreur a été placée sur un champ du formulaire.
 */
export function appliquerErreursServeur(formulaire: FormGroup, erreur: unknown): boolean {
  if (!(erreur instanceof ApiError)) return false;
  let place = false;
  for (const [champ, messages] of Object.entries(erreur.erreursChamps)) {
    const controle = formulaire.get(champ);
    if (controle) {
      controle.setErrors({ ...(controle.errors ?? {}), serveur: messages.join(' ') });
      controle.markAsTouched();
      place = true;
    }
  }
  return place;
}

/** Texte de l'erreur à afficher dans un toast. */
export function messageErreur(erreur: unknown, defaut = 'Une erreur est survenue.'): string {
  if (erreur instanceof ApiError) {
    const champs = Object.entries(erreur.erreursChamps);
    if (champs.length && erreur.statut === 400) {
      return champs.map(([, messages]) => messages.join(' ')).join(' ');
    }
    return erreur.message;
  }
  return defaut;
}
