import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { AuthService } from '../../../../core/services/auth.service';
import { BadgeComponent } from '../../../../shared/components/badge.component';
import { LoaderComponent } from '../../../../shared/components/loader.component';
import {
  DocumentJuridique,
  MODELES,
  STATUTS_JURIDIQUES,
  StatutDocumentJuridique,
  TypeDocumentJuridique,
  libelleStatut,
  libelleType,
  varianteStatut,
} from '../../models/legal.models';
import { LegalApiService } from '../../services/legal-api.service';

/**
 * Juridique (entrepreneur) : documents de son espace, filtrés par type et par statut
 * (GET /documents?projetId=&type=&statut=). Un administrateur voit les documents de tous les projets.
 */
@Component({
  selector: 'app-documents-juridiques',
  imports: [DatePipe, FormsModule, RouterLink, BadgeComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents.page.html',
  styleUrl: './documents.page.scss',
})
export class DocumentsPage implements OnInit {
  private readonly api = inject(LegalApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly estAdmin = inject(AuthService).currentUserValue?.role === 'ADMIN';

  protected readonly modeles = MODELES;
  protected readonly statuts = STATUTS_JURIDIQUES;
  protected readonly libelleType = libelleType;
  protected readonly libelleStatut = libelleStatut;
  protected readonly varianteStatut = varianteStatut;

  protected readonly filtreType = signal<TypeDocumentJuridique | null>(null);
  protected readonly filtreStatut = signal<StatutDocumentJuridique | null>(null);
  protected readonly documents = signal<DocumentJuridique[]>([]);
  private readonly tous = signal<DocumentJuridique[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<string | null>(null);

  /** Compteurs par statut, pour le type sélectionné (onglets). */
  protected readonly compteurs = computed(() => {
    const type = this.filtreType();
    const docs = this.tous().filter((d) => !type || d.type === type);
    const c: Record<string, number> = { ALL: docs.length };
    for (const s of STATUTS_JURIDIQUES) c[s.statut] = docs.filter((d) => d.statut === s.statut).length;
    return c;
  });
  protected readonly aValider = computed(() => this.tous().filter((d) => d.statut === 'VALIDE' && !d.isArchived).length);

  ngOnInit(): void {
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    const projetId = this.estAdmin ? null : this.api.projetCourant();
    forkJoin({
      liste: this.api.lister({ projetId, type: this.filtreType(), statut: this.filtreStatut() }),
      tous: this.api.lister({ projetId }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ liste, tous }) => {
          this.documents.set(liste);
          this.tous.set(tous);
          this.chargement.set(false);
        },
        error: (e: unknown) => {
          this.erreur.set(e instanceof ApiError ? e.message : 'Impossible de charger vos documents.');
          this.chargement.set(false);
        },
      });
  }

  protected choisirStatut(statut: StatutDocumentJuridique | null): void {
    if (this.filtreStatut() === statut) return;
    this.filtreStatut.set(statut);
    this.charger();
  }

  protected choisirType(type: TypeDocumentJuridique | null): void {
    this.filtreType.set(type);
    this.charger();
  }

  protected ouvrir(d: DocumentJuridique): void {
    this.router.navigate(['/juridique/documents', d.id]);
  }
}
