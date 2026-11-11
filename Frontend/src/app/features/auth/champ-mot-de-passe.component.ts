import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Champ mot de passe avec un bouton « œil » qui affiche / masque la saisie
 * (bascule type="password" / type="text"). S'utilise avec ngModel comme un <input> :
 *
 *   <label for="password">Mot de passe</label>
 *   <app-champ-mot-de-passe inputId="password" name="password" [(ngModel)]="password"
 *                           autocomplete="current-password" />
 *
 * Le bouton est un vrai <button type="button"> (n'envoie pas le formulaire, activable au
 * clavier avec Entrée / Espace), avec un aria-label et aria-pressed qui suivent son état.
 */
@Component({
  selector: 'app-champ-mot-de-passe',
  standalone: true,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ChampMotDePasseComponent), multi: true },
  ],
  template: `
    <div class="champ" [class.compact]="compact">
      <input
        [id]="inputId"
        [attr.name]="name"
        [type]="visible ? 'text' : 'password'"
        [value]="valeur"
        [placeholder]="placeholder"
        [required]="required"
        [disabled]="desactive"
        [attr.autocomplete]="autocomplete"
        autocapitalize="off"
        spellcheck="false"
        (input)="saisir($event)"
        (blur)="onTouched()"
      />
      <button
        type="button"
        class="oeil"
        [attr.aria-label]="visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
        [attr.aria-pressed]="visible"
        [attr.aria-controls]="inputId"
        [title]="visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
        [disabled]="desactive"
        (click)="basculer()"
      >
        @if (visible) {
          <!-- Œil barré : la saisie est visible, cliquer la masque -->
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/>
            <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/>
            <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/>
            <path d="m2 2 20 20"/>
          </svg>
        } @else {
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        }
      </button>
    </div>
  `,
  styles: [`
    @use 'variables' as *;

    :host { display: block; }

    .champ {
      position: relative;
    }

    input {
      width: 100%;
      min-height: 44px;
      padding: 0 46px 0 14px; /* place pour le bouton */
      border: 1px solid $bordure-champ;
      border-radius: $rayon-champ;
      font-size: 13.5px;
      color: $texte;
      outline: none;
      transition: border-color 0.15s ease;

      &:focus { border-color: $primaire; }
    }

    .compact input {
      min-height: 40px;
      padding: 0 44px 0 12px;
      font-size: 13px;
    }

    .oeil {
      position: absolute;
      top: 50%;
      right: 6px;
      transform: translateY(-50%);
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: $rayon-champ;
      background: transparent;
      color: $gris;
      cursor: pointer;
      transition: color 0.15s ease, background 0.15s ease;

      &:hover:not(:disabled) { color: $primaire-fonce; background: $fond-doux; }
      &:focus-visible { outline: 2px solid $primaire; outline-offset: 1px; color: $primaire-fonce; }
      &:disabled { cursor: not-allowed; opacity: 0.5; }
    }
  `],
})
export class ChampMotDePasseComponent implements ControlValueAccessor {
  /** id de l'<input> (à relier au <label for>). */
  @Input({ required: true }) inputId = '';
  @Input() name = '';
  @Input() placeholder = '••••••••';
  @Input() required = false;
  /** "current-password" (connexion) ou "new-password" (inscription, nouveau mot de passe). */
  @Input() autocomplete = 'current-password';
  /** Hauteur réduite, pour les formulaires plus denses (inscription). */
  @Input() compact = false;

  protected visible = false;
  protected valeur = '';
  protected desactive = false;

  private onChange: (valeur: string) => void = () => {};
  protected onTouched: () => void = () => {};

  protected basculer(): void {
    this.visible = !this.visible;
  }

  protected saisir(event: Event): void {
    this.valeur = (event.target as HTMLInputElement).value;
    this.onChange(this.valeur);
  }

  writeValue(valeur: string | null): void {
    this.valeur = valeur ?? '';
  }

  registerOnChange(fn: (valeur: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(desactive: boolean): void {
    this.desactive = desactive;
  }
}
