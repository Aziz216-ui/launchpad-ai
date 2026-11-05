import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BadgeComponent } from '../../../shared/components/badge.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { STATUTS } from '../models/libelles';
import { EtudeStore } from '../services/etude-store.service';

/** En-tête commun aux onglets d'une étude : titre, statut et actions (PDF, Finaliser). */
@Component({
  selector: 'app-etude-entete',
  imports: [DatePipe, RouterLink, BadgeComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.etude(); as etude) {
      <nav class="fil-ariane" aria-label="Fil d'Ariane">
        <a routerLink="/etude-marche">Mon espace</a><span aria-hidden="true">›</span>
        <a routerLink="/etude-marche">Étude de marché</a><span aria-hidden="true">›</span>
        <span class="courant">{{ etude.titre }}</span>
      </nav>

      <div class="entete-page">
        <div class="titre">
          <div class="titre-ligne">
            <h1>{{ etude.titre }}</h1>
            <app-badge [variante]="statuts[etude.statut].variante">{{ statuts[etude.statut].libelle }}</app-badge>
          </div>
          <p>
            @if (etude.cible) { {{ etude.cible }} · }
            @if (etude.zone_geographique) { {{ etude.zone_geographique }} · }
            Mis à jour le {{ etude.date_mise_a_jour | date: 'd MMMM y' }}
          </p>
        </div>
        <div class="actions">
          <button type="button" class="btn-secondaire" (click)="store.telechargerPdf()" [disabled]="store.telechargementEnCours()">
            <app-icon nom="telecharger" [taille]="16" />
            {{ store.telechargementEnCours() ? 'Génération du PDF…' : 'Télécharger le rapport PDF' }}
          </button>
          @if (store.estBrouillon()) {
            <button type="button" class="btn-primaire" (click)="store.finaliser()" [disabled]="store.finalisationEnCours()">
              <app-icon nom="valider" [taille]="16" />{{ store.finalisationEnCours() ? 'Finalisation…' : 'Finaliser' }}
            </button>
          } @else {
            <a class="btn-primaire" [routerLink]="['/etude-marche', etude.id, 'modifier']">
              <app-icon nom="crayon" [taille]="16" />Modifier
            </a>
          }
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class EtudeEnteteComponent {
  protected readonly store = inject(EtudeStore);
  protected readonly statuts = STATUTS;
}
