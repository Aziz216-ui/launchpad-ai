import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';

import { NotificationService } from '../../../core/notifications/notification.service';
import { FieldErrorComponent } from './field-error.component';
import { LoaderComponent } from '../../../shared/components/loader.component';
import { ModalComponent } from './modal.component';
import { MontantPipe, PourcentagePipe } from '../pipes/format.pipes';
import { formatSaisie, lireNombre } from '../utils/format';
import { appliquerErreursServeur, messageErreur, nombreValidator } from '../utils/form';
import { Concurrent, ConcurrentSaisie, EtudeMarcheDetail } from '../models/market.models';
import { MarketApiService } from '../services/market-api.service';

type Mode = 'associer' | 'creer' | 'modifier';

/**
 * Modale des concurrents d'une étude :
 * - associer : cocher des concurrents existants du secteur ;
 * - creer : créer un concurrent puis l'associer à l'étude ;
 * - modifier : modifier la fiche d'un concurrent.
 */
@Component({
  selector: 'app-concurrent-modal',
  imports: [ReactiveFormsModule, ModalComponent, FieldErrorComponent, LoaderComponent, MontantPipe, PourcentagePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './concurrent-modal.component.html',
  styles: `
    .liste {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 360px;
      overflow-y: auto;
    }
    .liste label {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid #e3e8ea;
      border-radius: 10px;
      cursor: pointer;
      font-size: 13px;
    }
    .liste input {
      width: 18px;
      height: 18px;
      accent-color: #2b7a86;
    }
    .liste .nom {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .liste small {
      font-size: 11px;
      color: #5a6a6f;
    }
    .vide {
      margin: 0 0 12px;
      font-size: 13px;
      color: #5a6a6f;
    }
    .formulaire {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .large {
      grid-column: span 2;
    }
    @media (max-width: 560px) {
      .formulaire {
        grid-template-columns: 1fr;
      }
      .large {
        grid-column: auto;
      }
    }
    .lien {
      margin-top: 14px;
      padding: 0;
      border: 0;
      background: transparent;
      color: #1f6470;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
  `,
})
export class ConcurrentModalComponent implements OnInit {
  private readonly api = inject(MarketApiService);
  private readonly notifications = inject(NotificationService);

  readonly etude = input.required<EtudeMarcheDetail>();
  /** Concurrent à modifier (mode « modifier »). */
  readonly concurrent = input<Concurrent | null>(null);
  readonly modeInitial = input<Mode>('associer');

  readonly fermer = output<void>();
  /** Émis après un enregistrement réussi : la page recharge l'étude. */
  readonly enregistre = output<void>();

  protected readonly mode = signal<Mode>('associer');
  protected readonly disponibles = signal<Concurrent[]>([]);
  protected readonly selection = signal<Set<number>>(new Set());
  protected readonly chargement = signal(false);
  protected readonly enCours = signal(false);

  protected readonly titre = computed(() =>
    ({ associer: 'Associer un concurrent', creer: 'Nouveau concurrent', modifier: 'Modifier le concurrent' })[this.mode()],
  );

  protected readonly formulaire = inject(FormBuilder).nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(150)]],
    pays: ['', Validators.maxLength(100)],
    prix_moyen: ['', [Validators.required, nombreValidator({ min: 0 })]],
    part_de_marche: ['', [Validators.required, nombreValidator({ min: 0, max: 100 })]],
    forces: [''],
    faiblesses: [''],
    site_web: [''],
  });

  ngOnInit(): void {
    this.mode.set(this.modeInitial());
    const c = this.concurrent();
    if (c) {
      this.formulaire.reset({
        nom: c.nom,
        pays: c.pays,
        prix_moyen: formatSaisie(c.prix_moyen),
        part_de_marche: formatSaisie(c.part_de_marche),
        forces: c.forces,
        faiblesses: c.faiblesses,
        site_web: c.site_web,
      });
    }
    if (this.mode() === 'associer') this.chargerDisponibles();
  }

  /** Concurrents du secteur de l'étude qui ne lui sont pas encore associés. */
  private chargerDisponibles(): void {
    const etude = this.etude();
    this.chargement.set(true);
    this.api.listerConcurrents({ secteur: etude.secteur }).subscribe({
      next: (liste) => {
        this.disponibles.set(liste.filter((c) => !etude.concurrents.includes(c.id)));
        this.chargement.set(false);
      },
      error: (e: unknown) => {
        this.chargement.set(false);
        this.notifications.erreur(messageErreur(e, 'Impossible de charger les concurrents.'));
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

  protected valider(): void {
    if (this.mode() === 'associer') this.associer();
    else this.enregistrerFiche();
  }

  private associer(): void {
    const ids = [...this.selection()];
    if (!ids.length) {
      this.notifications.info('Cochez au moins un concurrent à associer.');
      return;
    }
    const etude = this.etude();
    this.executer(
      this.api.modifierEtude(etude.id, { concurrents: [...etude.concurrents, ...ids] }),
      ids.length > 1 ? `${ids.length} concurrents associés à l'étude.` : 'Concurrent associé à l’étude.',
    );
  }

  private enregistrerFiche(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const v = this.formulaire.getRawValue();
    const saisie: ConcurrentSaisie = {
      nom: v.nom.trim(),
      pays: v.pays.trim(),
      prix_moyen: lireNombre(v.prix_moyen) ?? 0,
      part_de_marche: lireNombre(v.part_de_marche) ?? 0,
      forces: v.forces.trim(),
      faiblesses: v.faiblesses.trim(),
      site_web: v.site_web.trim(),
    };
    const etude = this.etude();
    const existant = this.concurrent();

    if (this.mode() === 'modifier' && existant) {
      this.executer(this.api.modifierConcurrent(existant.id, saisie), 'Concurrent mis à jour.');
    } else {
      this.executer(
        this.api
          .creerConcurrent({ ...saisie, secteur: etude.secteur })
          .pipe(switchMap((cree) => this.api.modifierEtude(etude.id, { concurrents: [...etude.concurrents, cree.id] }))),
        'Concurrent créé et associé à l’étude.',
      );
    }
  }

  private executer(requete: Observable<unknown>, succes: string): void {
    this.enCours.set(true);
    requete.subscribe({
      next: () => {
        this.enCours.set(false);
        this.notifications.succes(succes);
        this.enregistre.emit();
      },
      error: (e: unknown) => {
        this.enCours.set(false);
        appliquerErreursServeur(this.formulaire, e);
        this.notifications.erreur(messageErreur(e, "L'enregistrement a échoué."));
      },
    });
  }
}
