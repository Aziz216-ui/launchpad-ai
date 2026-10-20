import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NotificationService } from '../../../core/notifications/notification.service';
import { FieldErrorComponent } from './field-error.component';
import { ModalComponent } from './modal.component';
import { appliquerErreursServeur, messageErreur } from '../utils/form';
import { TYPES_SWOT } from '../models/libelles';
import { ElementSwot, TypeSwot } from '../models/market.models';
import { MarketApiService } from '../services/market-api.service';

/** Ajout ou modification d'un élément SWOT saisi à la main. */
@Component({
  selector: 'app-swot-modal',
  imports: [ReactiveFormsModule, ModalComponent, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [titre]="element() ? 'Modifier l’élément' : 'Ajouter un élément'" [largeur]="520" (fermer)="fermer.emit()">
      <form class="pile" [formGroup]="formulaire" (ngSubmit)="enregistrer()" novalidate>
        <label class="champ" [class.en-erreur]="formulaire.controls.type.touched && formulaire.controls.type.invalid">
          Catégorie *
          <select formControlName="type">
            @for (t of types; track t.type) {
              <option [value]="t.type">{{ t.libelle }} ({{ t.nature }})</option>
            }
          </select>
          <app-field-error [controle]="formulaire.controls.type" />
        </label>
        <label class="champ" [class.en-erreur]="formulaire.controls.description.touched && formulaire.controls.description.invalid">
          Description *
          <textarea rows="3" formControlName="description" placeholder="Ex. Équipe fondatrice issue du secteur"></textarea>
          <app-field-error [controle]="formulaire.controls.description" />
        </label>
        @if (element()?.genere_automatiquement) {
          <p class="avertissement">Cet élément a été généré automatiquement : il sera remplacé à la prochaine
            génération de la SWOT. Pour le conserver, ajoutez-le plutôt comme nouvel élément.</p>
        }
      </form>
      <ng-container pied>
        <button type="button" class="btn-secondaire" (click)="fermer.emit()" [disabled]="enCours()">Annuler</button>
        <button type="button" class="btn-primaire" (click)="enregistrer()" [disabled]="enCours()">
          {{ enCours() ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .pile {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .avertissement {
      margin: 0;
      padding: 10px 12px;
      border-radius: 10px;
      background: #fdf0dc;
      color: #7a4805;
      font-size: 12px;
      line-height: 1.5;
    }
  `,
})
export class SwotModalComponent implements OnInit {
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);

  readonly etudeId = input.required<number>();
  readonly element = input<ElementSwot | null>(null);
  /** Catégorie présélectionnée en création. */
  readonly typeInitial = input<TypeSwot>('force');
  readonly fermer = output<void>();
  readonly enregistre = output<void>();

  protected readonly types = TYPES_SWOT;
  protected readonly enCours = signal(false);

  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    type: ['force' as TypeSwot, Validators.required],
    description: ['', Validators.required],
  });

  ngOnInit(): void {
    const e = this.element();
    this.formulaire.reset({ type: e?.type ?? this.typeInitial(), description: e?.description ?? '' });
  }

  protected enregistrer(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const v = this.formulaire.getRawValue();
    const saisie = { etude: this.etudeId(), type: v.type, description: v.description.trim() };
    const existant = this.element();
    const requete = existant
      ? this.api.modifierElementSwot(existant.id, saisie)
      : this.api.creerElementSwot(saisie);

    this.enCours.set(true);
    requete.subscribe({
      next: () => {
        this.enCours.set(false);
        this.notifications.succes(existant ? 'Élément mis à jour.' : 'Élément ajouté à la SWOT.');
        this.enregistre.emit();
      },
      error: (e: unknown) => {
        this.enCours.set(false);
        appliquerErreursServeur(this.formulaire, e);
        this.notifications.erreur(messageErreur(e, "Impossible d'enregistrer l'élément."));
      },
    });
  }
}
