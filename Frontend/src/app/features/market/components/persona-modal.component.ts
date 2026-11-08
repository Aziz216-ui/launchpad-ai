import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NotificationService } from '../../../core/notifications/notification.service';
import { FieldErrorComponent } from './field-error.component';
import { ModalComponent } from './modal.component';
import { formatSaisie, lireNombre } from '../utils/format';
import { appliquerErreursServeur, messageErreur, nombreValidator } from '../utils/form';
import { Persona, PersonaSaisie } from '../models/market.models';
import { MarketApiService } from '../services/market-api.service';

const TRANCHES_AGE = ['18 – 24 ans', '25 – 34 ans', '35 – 44 ans', '45 – 54 ans', '55 – 64 ans', '65 ans et plus'];

/** Modale « Ajouter un persona » / « Modifier le persona » (maquette Modales.dc.html). */
@Component({
  selector: 'app-persona-modal',
  imports: [ReactiveFormsModule, ModalComponent, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [titre]="persona() ? 'Modifier le persona' : 'Ajouter un persona'" (fermer)="fermer.emit()">
      <form class="grille" [formGroup]="formulaire" (ngSubmit)="enregistrer()" novalidate>
        <label class="champ large" [class.en-erreur]="formulaire.controls.nom.touched && formulaire.controls.nom.invalid">
          Nom du persona *
          <input type="text" formControlName="nom" placeholder="Ex. Claire, la libérale débordée" />
          <app-field-error [controle]="formulaire.controls.nom" />
        </label>
        <label class="champ">
          Tranche d'âge
          <select formControlName="tranche_age">
            <option value="">Non précisée</option>
            @for (t of tranches(); track t) {
              <option [value]="t">{{ t }}</option>
            }
          </select>
        </label>
        <label class="champ" [class.en-erreur]="formulaire.controls.profession.touched && formulaire.controls.profession.invalid">
          Profession
          <input type="text" formControlName="profession" placeholder="Ex. Diététicienne libérale" />
          <app-field-error [controle]="formulaire.controls.profession" />
        </label>
        <label class="champ" [class.en-erreur]="formulaire.controls.localisation.touched && formulaire.controls.localisation.invalid">
          Localisation
          <input type="text" formControlName="localisation" placeholder="Ex. Lyon" />
          <app-field-error [controle]="formulaire.controls.localisation" />
        </label>
        <label class="champ" [class.en-erreur]="formulaire.controls.revenu_estime.touched && formulaire.controls.revenu_estime.invalid">
          Revenu estimé (€ / mois)
          <input type="text" inputmode="numeric" formControlName="revenu_estime" placeholder="Ex. 2 800" />
          <app-field-error [controle]="formulaire.controls.revenu_estime" />
        </label>
        <label class="champ large">
          Besoins
          <textarea rows="2" formControlName="besoins" placeholder="Un besoin par ligne"></textarea>
        </label>
        <label class="champ large">
          Frustrations
          <textarea rows="2" formControlName="frustrations" placeholder="Une frustration par ligne"></textarea>
        </label>
        <label class="champ large">
          Comportement d'achat
          <textarea rows="2" formControlName="comportement_achat" placeholder="Comment choisit-il un outil ? Quel budget ?"></textarea>
        </label>
      </form>
      <ng-container pied>
        <button type="button" class="btn-secondaire" (click)="fermer.emit()" [disabled]="enCours()">Annuler</button>
        <button type="button" class="btn-primaire" (click)="enregistrer()" [disabled]="enCours()">
          {{ enCours() ? 'Enregistrement…' : 'Enregistrer le persona' }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .grille {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .large {
      grid-column: span 2;
    }
    @media (max-width: 560px) {
      .grille {
        grid-template-columns: 1fr;
      }
      .large {
        grid-column: auto;
      }
    }
  `,
})
export class PersonaModalComponent implements OnInit {
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);

  readonly etudeId = input.required<number>();
  /** Persona à modifier ; absent en création. */
  readonly persona = input<Persona | null>(null);
  readonly fermer = output<void>();
  readonly enregistre = output<void>();

  protected readonly enCours = signal(false);

  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(150)]],
    tranche_age: [''],
    profession: ['', Validators.maxLength(150)],
    localisation: ['', Validators.maxLength(150)],
    revenu_estime: ['', nombreValidator({ min: 0 })],
    besoins: [''],
    frustrations: [''],
    comportement_achat: [''],
  });

  /** Tranches proposées, plus la valeur existante si elle n'en fait pas partie. */
  protected readonly tranches = computed(() => {
    const actuelle = this.persona()?.tranche_age;
    return actuelle && !TRANCHES_AGE.includes(actuelle) ? [actuelle, ...TRANCHES_AGE] : TRANCHES_AGE;
  });

  ngOnInit(): void {
    const p = this.persona();
    if (p) {
      this.formulaire.reset({
        nom: p.nom,
        tranche_age: p.tranche_age,
        profession: p.profession,
        localisation: p.localisation,
        revenu_estime: formatSaisie(p.revenu_estime),
        besoins: p.besoins,
        frustrations: p.frustrations,
        comportement_achat: p.comportement_achat,
      });
    }
  }

  protected enregistrer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const v = this.formulaire.getRawValue();
    const saisie: PersonaSaisie = {
      etude: this.etudeId(),
      nom: v.nom.trim(),
      tranche_age: v.tranche_age,
      profession: v.profession.trim(),
      localisation: v.localisation.trim(),
      revenu_estime: lireNombre(v.revenu_estime),
      besoins: v.besoins.trim(),
      frustrations: v.frustrations.trim(),
      comportement_achat: v.comportement_achat.trim(),
    };
    const existant = this.persona();
    const requete = existant ? this.api.modifierPersona(existant.id, saisie) : this.api.creerPersona(saisie);

    this.enCours.set(true);
    requete.subscribe({
      next: () => {
        this.enCours.set(false);
        this.notifications.succes(existant ? 'Persona mis à jour.' : 'Persona ajouté.');
        this.enregistre.emit();
      },
      error: (e: unknown) => {
        this.enCours.set(false);
        appliquerErreursServeur(this.formulaire, e);
        this.notifications.erreur(messageErreur(e, "Impossible d'enregistrer le persona."));
      },
    });
  }
}
