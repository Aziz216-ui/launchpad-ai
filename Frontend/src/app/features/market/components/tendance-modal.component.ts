import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';

import { NotificationService } from '../../../core/notifications/notification.service';
import { BadgeComponent } from '../../../shared/components/badge.component';
import { LoaderComponent } from '../../../shared/components/loader.component';
import { ModalComponent } from './modal.component';
import { messageErreur } from '../utils/form';
import { IMPACTS } from '../models/libelles';
import { EtudeMarcheDetail, Tendance } from '../models/market.models';
import { MarketApiService } from '../services/market-api.service';

/** Modale « Associer une tendance » : tendances du secteur pas encore retenues pour l'étude. */
@Component({
  selector: 'app-tendance-modal',
  imports: [ModalComponent, LoaderComponent, BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal titre="Associer une tendance" (fermer)="fermer.emit()">
      @if (chargement()) {
        <app-loader texte="Chargement des tendances…" />
      } @else if (disponibles().length) {
        <p class="aide">Tendances du secteur {{ etude().secteur_nom }} pas encore associées à cette étude :</p>
        <ul>
          @for (t of disponibles(); track t.id) {
            <li>
              <label>
                <input type="checkbox" [checked]="selection().has(t.id)" (change)="basculer(t.id)" />
                <span class="texte"><strong>{{ t.titre }}</strong>
                  @if (t.description) {<small>{{ t.description }}</small>}
                </span>
                <app-badge [petit]="true" [variante]="impacts[t.impact].variante">{{ impacts[t.impact].libelle }}</app-badge>
              </label>
            </li>
          }
        </ul>
      } @else {
        <p class="aide">Toutes les tendances du secteur {{ etude().secteur_nom }} sont déjà associées à l'étude.
          Un administrateur peut en ajouter depuis l'admin du Market-Service.</p>
      }
      <ng-container pied>
        <button type="button" class="btn-secondaire" (click)="fermer.emit()" [disabled]="enCours()">Annuler</button>
        <button type="button" class="btn-primaire" (click)="associer()" [disabled]="enCours() || !selection().size">
          {{ enCours() ? 'Enregistrement…' : 'Associer' }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .aide {
      margin: 0 0 12px;
      font-size: 13px;
      color: #5a6a6f;
      line-height: 1.5;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 380px;
      overflow-y: auto;
    }
    label {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid #e3e8ea;
      border-radius: 10px;
      cursor: pointer;
      font-size: 13px;
    }
    input {
      width: 18px;
      height: 18px;
      accent-color: #2b7a86;
    }
    .texte {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    small {
      font-size: 12px;
      color: #5a6a6f;
    }
  `,
})
export class TendanceModalComponent implements OnInit {
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);

  readonly etude = input.required<EtudeMarcheDetail>();
  readonly fermer = output<void>();
  readonly enregistre = output<void>();

  protected readonly impacts = IMPACTS;
  protected readonly disponibles = signal<Tendance[]>([]);
  protected readonly selection = signal<Set<number>>(new Set());
  protected readonly chargement = signal(true);
  protected readonly enCours = signal(false);

  ngOnInit(): void {
    const etude = this.etude();
    this.api.listerTendances({ secteur: etude.secteur }).subscribe({
      next: (liste) => {
        this.disponibles.set(liste.filter((t) => !etude.tendances.includes(t.id)));
        this.chargement.set(false);
      },
      error: (e: unknown) => {
        this.chargement.set(false);
        this.notifications.erreur(messageErreur(e, 'Impossible de charger les tendances.'));
      },
    });
  }

  protected basculer(id: number): void {
    this.selection.update((s) => {
      const copie = new Set(s);
      if (copie.has(id)) copie.delete(id);
      else copie.add(id);
      return copie;
    });
  }

  protected associer(): void {
    const etude = this.etude();
    const ids = [...this.selection()];
    this.enCours.set(true);
    this.api.modifierEtude(etude.id, { tendances: [...etude.tendances, ...ids] }).subscribe({
      next: () => {
        this.enCours.set(false);
        this.notifications.succes(ids.length > 1 ? `${ids.length} tendances associées.` : 'Tendance associée.');
        this.enregistre.emit();
      },
      error: (e: unknown) => {
        this.enCours.set(false);
        this.notifications.erreur(messageErreur(e, 'Impossible d’associer ces tendances.'));
      },
    });
  }
}
