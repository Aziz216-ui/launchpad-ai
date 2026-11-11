import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiError } from '../../../../core/http/api-error';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ChampParametre, MODELES, ModeleDocument, TypeDocumentJuridique } from '../../models/legal.models';
import { LegalApiService } from '../../services/legal-api.service';

/**
 * Création d'un document juridique (POST /documents/generate) : choix du type, puis formulaire dont
 * les champs dépendent du type. Le document est créé en BROUILLON avec ses clauses pré-remplies.
 */
@Component({
  selector: 'app-nouveau-document',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nouveau-document.page.html',
  styleUrl: './nouveau-document.page.scss',
})
export class NouveauDocumentPage {
  private readonly api = inject(LegalApiService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly formulaire = viewChild<ElementRef<HTMLFormElement>>('formulaire');

  protected readonly modeles = MODELES;
  protected readonly modele = signal<ModeleDocument | null>(this.modeleInitial(inject(ActivatedRoute).snapshot.queryParamMap.get('type')));
  protected valeurs: Record<string, string> = {};
  protected readonly erreurs = signal<Record<string, string>>({});
  protected readonly erreurGenerale = signal<string | null>(null);
  protected readonly envoi = signal(false);

  protected choisir(m: ModeleDocument): void {
    this.modele.set(m);
    this.valeurs = {};
    this.erreurs.set({});
    this.erreurGenerale.set(null);
    this.router.navigate([], { queryParams: { type: m.type }, replaceUrl: true });
    setTimeout(() => this.formulaire()?.nativeElement.querySelector<HTMLElement>('input, select, textarea')?.focus());
  }

  protected changerType(): void {
    this.modele.set(null);
    this.router.navigate([], { queryParams: { type: null }, replaceUrl: true });
  }

  protected identifiant(champ: ChampParametre): string {
    return `champ-${champ.cle}`;
  }

  protected effacerErreur(cle: string): void {
    if (!this.erreurs()[cle]) return;
    const { [cle]: _, ...autres } = this.erreurs();
    this.erreurs.set(autres);
  }

  protected creer(): void {
    const m = this.modele();
    if (!m || this.envoi()) return;

    const erreurs: Record<string, string> = {};
    const params: Record<string, unknown> = {};
    for (const champ of m.champs) {
      const brut = (this.valeurs[champ.cle] ?? '').trim();
      if (!brut) {
        if (champ.obligatoire) erreurs[champ.cle] = 'Ce champ est obligatoire.';
        continue;
      }
      if (champ.type === 'nombre') {
        const n = Number(brut.replace(',', '.'));
        if (!Number.isFinite(n) || n <= 0) erreurs[champ.cle] = 'Indiquez un nombre positif.';
        else params[champ.cle] = n;
      } else if (champ.type === 'liste') {
        params[champ.cle] = brut.split('\n').map((l) => l.trim()).filter(Boolean);
      } else {
        params[champ.cle] = brut;
      }
    }
    this.erreurs.set(erreurs);
    this.erreurGenerale.set(null);
    if (Object.keys(erreurs).length) {
      const premier = m.champs.find((c) => erreurs[c.cle]);
      if (premier) document.getElementById(this.identifiant(premier))?.focus();
      return;
    }

    this.envoi.set(true);
    this.api.generer(m.type, params).subscribe({
      next: (doc) => {
        this.envoi.set(false);
        this.notifications.succes(`« ${doc.titre} » créé en brouillon avec ${doc.clauses.length} clauses.`);
        this.router.navigate(['/juridique/documents', doc.id]);
      },
      error: (e: unknown) => {
        this.envoi.set(false);
        this.erreurGenerale.set(e instanceof ApiError ? e.message : "Le document n'a pas pu être créé. Réessayez.");
      },
    });
  }

  private modeleInitial(type: string | null): ModeleDocument | null {
    return MODELES.find((m) => m.type === (type as TypeDocumentJuridique)) ?? null;
  }
}
