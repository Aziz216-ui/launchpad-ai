import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

/**
 * Message d'erreur sous un champ de formulaire.
 * Affiche l'erreur de validation locale ou celle renvoyée par l'API (clé `serveur`).
 */
@Component({
  selector: 'app-field-error',
  changeDetection: ChangeDetectionStrategy.Default,
  styles: `
    span {
      font-size: 11px;
      font-weight: 500;
      color: #b23a3a;
    }
  `,
  template: `@if (message(); as texte) {<span class="erreur-champ" role="alert">{{ texte }}</span>}`,
})
export class FieldErrorComponent {
  readonly controle = input.required<AbstractControl | null>();

  protected message(): string | null {
    const controle = this.controle();
    if (!controle?.errors || !(controle.touched || controle.errors['serveur'])) return null;
    const e = controle.errors;
    if (e['serveur']) return e['serveur'];
    if (e['required']) return 'Ce champ est obligatoire.';
    if (e['nombre']) return 'Saisissez un nombre valide (ex. 8,4).';
    if (e['min']) return `La valeur doit être supérieure ou égale à ${e['min'].min}.`;
    if (e['max']) return `La valeur doit être inférieure ou égale à ${e['max'].max}.`;
    if (e['maxlength']) return `${e['maxlength'].requiredLength} caractères maximum.`;
    return 'Valeur invalide.';
  }
}
