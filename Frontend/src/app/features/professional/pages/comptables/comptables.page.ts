import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { DemandeComptableModalComponent } from '../../components/demande-comptable-modal.component';
import { DossierComptable, EspaceComptable, StatutDossier } from '../../models/comptabilite.models';
import { ComptabiliteApiService } from '../../services/comptabilite-api.service';

/** Annuaire « Demander un comptable » : une carte par comptable inscrit et ouvert aux demandes. */
@Component({
  selector: 'app-comptables',
  imports: [DatePipe, FormsModule, RouterLink, BadgeComponent, LoaderComponent, DemandeComptableModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comptables.page.html',
  styleUrl: './comptables.page.scss',
})
export class ComptablesPage implements OnInit {
  private readonly api = inject(ComptabiliteApiService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly comptables = signal<EspaceComptable[]>([]);
  /** Dossiers ouverts (en attente / actifs) de l'entrepreneur, par espace comptable. */
  protected readonly ouverts = signal<Record<string, StatutDossier>>({});
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly recherche = signal('');
  protected readonly choisi = signal<EspaceComptable | null>(null);

  protected readonly filtres = computed(() => {
    const q = normaliser(this.recherche());
    return q ? this.comptables().filter((c) => normaliser(c.displayName).includes(q)) : this.comptables();
  });

  ngOnInit(): void {
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    forkJoin({
      comptables: this.api.listerComptables(),
      // Indicatif seulement : l'annuaire reste utilisable si les dossiers ne se chargent pas.
      dossiers: this.api.listerDossiers({ limite: 100 }).pipe(catchError(() => of({ data: [] as DossierComptable[] }))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ comptables, dossiers }) => {
          const ouverts: Record<string, StatutDossier> = {};
          for (const d of dossiers.data) {
            if (d.status === 'ACTIVE' || (d.status === 'PENDING' && ouverts[d.workspace.id] !== 'ACTIVE')) {
              ouverts[d.workspace.id] = d.status;
            }
          }
          this.comptables.set(comptables);
          this.ouverts.set(ouverts);
          this.chargement.set(false);
        },
        error: (e: unknown) => {
          this.erreur.set(e instanceof ApiError ? e.message : 'Impossible de charger les comptables.');
          this.chargement.set(false);
        },
      });
  }

  protected initiales(nom: string): string {
    const mots = nom.trim().split(/\s+/).filter(Boolean);
    return ((mots[0]?.[0] ?? '') + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase() || '?';
  }

  protected demandeEnvoyee(dossier: DossierComptable): void {
    this.choisi.set(null);
    this.notifications.succes(`Demande ${dossier.reference} envoyée à ${dossier.workspace.displayName}.`);
    this.router.navigateByUrl('/professional/comptabilite');
  }
}

function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
