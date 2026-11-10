import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import {
  DocumentJuridique,
  MODELES,
  StatutDocumentJuridique,
  TypeDocumentJuridique,
  libelleStatut,
  libelleType,
  varianteStatut,
} from '../../models/legal.models';
import { LegalApiService } from '../../services/legal-api.service';

const ONGLETS: { statut: StatutDocumentJuridique; libelle: string; vide: string }[] = [
  { statut: 'EN_VALIDATION', libelle: 'À revoir', vide: 'Aucun document en attente de revue.' },
  { statut: 'VALIDE', libelle: 'Validés', vide: 'Aucun document validé en attente de signature.' },
  { statut: 'SIGNE', libelle: 'Signés', vide: 'Aucun document signé.' },
  { statut: 'REFUSE', libelle: 'Refusés', vide: 'Aucun document refusé.' },
];

/** Espace avocat : documents juridiques à revoir (GET /documents?statut=EN_VALIDATION), validés, signés, refusés. */
@Component({
  selector: 'app-revue-liste',
  imports: [DatePipe, FormsModule, RouterLink, BadgeComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './revue-liste.page.html',
  styleUrl: './revue-liste.page.scss',
})
export class RevueListePage implements OnInit {
  private readonly api = inject(LegalApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly onglets = ONGLETS;
  protected readonly modeles = MODELES;
  protected readonly libelleType = libelleType;
  protected readonly libelleStatut = libelleStatut;
  protected readonly varianteStatut = varianteStatut;

  protected readonly statut = signal<StatutDocumentJuridique>('EN_VALIDATION');
  protected readonly type = signal<TypeDocumentJuridique | null>(null);
  protected readonly documents = signal<DocumentJuridique[]>([]);
  private readonly tous = signal<DocumentJuridique[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);

  protected readonly compteurs = computed(() => {
    const t = this.type();
    const c: Record<string, number> = {};
    for (const o of ONGLETS) c[o.statut] = this.tous().filter((d) => d.statut === o.statut && (!t || d.type === t)).length;
    return c;
  });
  protected readonly texteVide = computed(() => ONGLETS.find((o) => o.statut === this.statut())?.vide ?? '');

  ngOnInit(): void {
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    forkJoin({ liste: this.api.listerPourRevue(this.statut(), this.type()), tous: this.api.lister() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ liste, tous }) => {
          this.documents.set(liste.filter((d) => !d.isArchived || this.statut() !== 'EN_VALIDATION'));
          this.tous.set(tous);
          this.chargement.set(false);
        },
        error: (e: unknown) => {
          this.erreur.set(e instanceof ApiError ? e.message : 'Impossible de charger les documents.');
          this.chargement.set(false);
        },
      });
  }

  protected choisirStatut(s: StatutDocumentJuridique): void {
    if (s === this.statut()) return;
    this.statut.set(s);
    this.charger();
  }

  protected choisirType(t: TypeDocumentJuridique | null): void {
    this.type.set(t);
    this.charger();
  }

  protected ouvrir(d: DocumentJuridique): void {
    this.router.navigate(['/juridique/revue', d.id]);
  }
}
