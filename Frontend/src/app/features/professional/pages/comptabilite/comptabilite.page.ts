import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { AuthService } from '../../../../core/services/auth.service';
import { BadgeComponent, VarianteBadge } from '../../../../shared/components/badge.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import { DossierComptable, STATUTS_DOSSIER, StatutDossier } from '../../models/comptabilite.models';
import { ComptabiliteApiService } from '../../services/comptabilite-api.service';

const VARIANTES: Record<StatutDossier, VarianteBadge> = {
  PENDING: 'attention',
  ACTIVE: 'succes',
  REJECTED: 'danger',
  CLOSED: 'neutre',
};

/**
 * Comptabilité : dossiers de l'utilisateur avec son comptable (onglets par statut, compteurs, tableau paginé).
 * L'entrepreneur y accède à l'annuaire « Demander un comptable ».
 */
@Component({
  selector: 'app-comptabilite',
  imports: [DatePipe, FormsModule, RouterLink, BadgeComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comptabilite.page.html',
  styleUrl: './comptabilite.page.scss',
})
export class ComptabilitePage implements OnInit {
  private readonly api = inject(ComptabiliteApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly role = inject(AuthService).currentUserValue?.role;

  protected readonly estEntrepreneur = this.role === 'ENTREPRENEUR';
  protected readonly espace = this.role === 'ACCOUNTANT' ? 'Espace comptable' : 'Espace startup';
  protected readonly statuts = STATUTS_DOSSIER;
  protected readonly taillesPage = [10, 20, 50];

  protected readonly filtre = signal<StatutDossier | null>(null);
  protected readonly dossiers = signal<DossierComptable[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly limite = signal(20);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  /** Compteurs par statut ; null tant qu'ils ne sont pas chargés (affiché « — »). */
  protected readonly compteurs = signal<Record<StatutDossier | 'ALL', number> | null>(null);

  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.limite())));
  protected readonly plage = computed(() => {
    if (!this.total()) return '0 sur 0';
    const debut = (this.page() - 1) * this.limite() + 1;
    return `${debut}–${Math.min(this.page() * this.limite(), this.total())} sur ${this.total()}`;
  });
  protected readonly titreTableau = computed(() => {
    const f = this.filtre();
    return f ? `Dossiers · ${this.libelle(f).toLowerCase()}` : 'Tous les dossiers';
  });

  ngOnInit(): void {
    this.chargerCompteurs();
    this.chargerDossiers();
  }

  protected choisirFiltre(statut: StatutDossier | null): void {
    if (this.filtre() === statut) return;
    this.filtre.set(statut);
    this.page.set(1);
    this.chargerDossiers();
  }

  protected allerPage(page: number): void {
    if (page < 1 || page > this.pages() || page === this.page()) return;
    this.page.set(page);
    this.chargerDossiers();
  }

  protected changerLimite(limite: number): void {
    this.limite.set(Number(limite));
    this.page.set(1);
    this.chargerDossiers();
  }

  protected recharger(): void {
    this.chargerCompteurs();
    this.chargerDossiers();
  }

  protected ouvrir(d: DossierComptable): void {
    this.router.navigate(['dossiers', d.id], { relativeTo: this.route });
  }

  protected libelle(statut: StatutDossier): string {
    return STATUTS_DOSSIER.find((s) => s.statut === statut)?.libelle ?? statut;
  }

  protected variante(statut: StatutDossier): VarianteBadge {
    return VARIANTES[statut];
  }

  protected compteur(cle: StatutDossier | 'ALL'): string {
    const c = this.compteurs();
    return c ? String(c[cle]) : '—';
  }

  private chargerDossiers(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.api
      .listerDossiers({ statut: this.filtre(), page: this.page(), limite: this.limite() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.dossiers.set(r.data);
          this.total.set(r.meta.total);
          this.chargement.set(false);
        },
        error: (e: unknown) => {
          this.dossiers.set([]);
          this.total.set(0);
          this.erreur.set(e instanceof ApiError ? e.message : 'Impossible de charger vos dossiers.');
          this.chargement.set(false);
        },
      });
  }

  private chargerCompteurs(): void {
    const compter = (s: StatutDossier | null) => this.api.compterDossiers(s).pipe(catchError(() => of(null)));
    forkJoin({
      ALL: compter(null),
      PENDING: compter('PENDING'),
      ACTIVE: compter('ACTIVE'),
      REJECTED: compter('REJECTED'),
      CLOSED: compter('CLOSED'),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((c) => {
        const complet = Object.values(c).every((v) => v !== null);
        this.compteurs.set(complet ? (c as Record<StatutDossier | 'ALL', number>) : null);
      });
  }
}
