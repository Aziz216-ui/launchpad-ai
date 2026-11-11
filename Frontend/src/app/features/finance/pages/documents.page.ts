import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NotificationService } from '../../../core/notifications/notification.service';
import { BadgeComponent } from '../../../shared/components/badge.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { LoaderComponent } from '../../../shared/components/loader.component';
import { DocumentFinancier, DocumentResume, FormatExport, TypeDocument } from '../models/finance.models';
import { TYPES_DOCUMENT, libelleType } from '../models/libelles';
import { MontantPipe } from '../pipes/montant.pipe';
import { messageErreur, texteErreur } from '../services/erreurs';
import { FinanceApiService } from '../services/finance-api.service';
import { FinanceStore } from '../services/finance-store.service';

/** Documents financiers du projet : génération (scénario 3), consultation, export PDF / Excel et suppression (scénario 4). */
@Component({
  selector: 'app-finance-documents',
  imports: [FormsModule, DatePipe, BadgeComponent, ConfirmModalComponent, EmptyStateComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="colonnes">
        <section class="principale">
          @if (chargement()) {
            <app-loader />
          } @else if (documents().length) {
            <div class="tableau-conteneur">
              <table>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Créé le</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of documents(); track d.documentId) {
                    <tr [class.actif]="d.documentId === ouvert()?.documentId">
                      <td>
                        <strong>{{ d.titre }}</strong>
                        @if (d.certification) {
                          <app-badge variante="succes" [petit]="true">Certifié</app-badge>
                        }
                      </td>
                      <td><app-badge variante="info" [petit]="true">{{ libelle(d.type) }}</app-badge></td>
                      <td>{{ d.creeLe | date: 'd MMM y, HH:mm' }}</td>
                      <td class="actions">
                        <button type="button" class="btn-texte" (click)="ouvrir(d)">
                          {{ store.peutValider() && !d.certification ? 'Examiner' : 'Voir' }}
                        </button>
                        <button type="button" class="btn-texte" (click)="exporter(d, 'pdf')" [disabled]="export() !== null">PDF</button>
                        <button type="button" class="btn-texte" (click)="exporter(d, 'xlsx')" [disabled]="export() !== null">Excel</button>
                        @if (store.peutEcrire()) {
                          <button type="button" class="btn-texte danger" (click)="aSupprimer.set(d)">Supprimer</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else if (store.peutEcrire()) {
            <app-empty-state titre="Aucun document"
              texte="Générez un business plan, un bilan ou un plan de trésorerie à partir de votre prévision." />
          } @else {
            <app-empty-state titre="Aucun document" texte="L'entrepreneur n'a pas encore généré de document pour ce projet." />
          }

          @if (ouvert(); as doc) {
            <article class="carte apercu" aria-live="polite">
              <div class="entete-carte">
                <div>
                  <h2>{{ doc.contenu.titre }}</h2>
                  <span class="sous-titre">{{ libelle(doc.type) }} · {{ doc.creeLe | date: 'd MMM y' }}</span>
                </div>
                <button type="button" class="btn-texte" (click)="ouvert.set(null)">Fermer</button>
              </div>
              @if (doc.certification; as c) {
                <div class="certification" role="status">
                  <strong>Certifié par {{ c.auteur }}</strong> le {{ c.le | date: 'd MMM y, HH:mm' }}
                  @if (c.commentaire) {<p>« {{ c.commentaire }} »</p>}
                </div>
              } @else if (store.peutValider()) {
                <div class="certification a-faire">
                  <label class="champ">
                    Certifier ce document avant son envoi à un investisseur
                    <textarea name="commentaireCertification" rows="2" maxlength="2000"
                      [(ngModel)]="commentaireCertification" placeholder="Commentaire (facultatif)"></textarea>
                  </label>
                  <button type="button" class="btn-primaire" [disabled]="certificationEnCours()" (click)="certifier(doc)">
                    {{ certificationEnCours() ? 'Certification…' : 'Certifier le document' }}
                  </button>
                  <span class="note">Possible seulement si la prévision dont il est tiré a été validée et n'a pas changé depuis la génération du document.</span>
                </div>
              } @else {
                <span class="note">Pas encore certifié par un financier.</span>
              }
              @for (section of doc.contenu.sections; track section.titre) {
                <section class="section">
                  <h3>{{ section.titre }}</h3>
                  @if (section.lignes.length) {
                    <div class="tableau-conteneur">
                      <table>
                        <thead>
                          <tr>
                            <th></th>
                            @for (c of section.colonnes; track c) {<th class="num">{{ c }}</th>}
                          </tr>
                        </thead>
                        <tbody>
                          @for (l of section.lignes; track l.libelle) {
                            <tr>
                              <td>{{ l.libelle }}</td>
                              @for (v of l.valeurs; track $index) {
                                <td class="num">{{ valeur(section.colonnes[$index], l.libelle, v) }}</td>
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                  @for (note of section.notes; track $index) {
                    <p [class.ia]="estAnalyse(section.titre)">{{ note }}</p>
                  }
                </section>
              }
            </article>
          }
        </section>

        @if (store.peutEcrire()) {
        <form class="carte formulaire" (ngSubmit)="generer()" novalidate aria-label="Générer un document">
          <h2>Générer un document</h2>
          <label class="champ">
            Type de document
            <select name="type" [(ngModel)]="type">
              @for (t of types; track t.valeur) {<option [value]="t.valeur">{{ t.libelle }}</option>}
            </select>
          </label>
          <label class="champ">
            Trésorerie initiale
            <input name="tresorerie" type="number" min="0" step="0.01" [(ngModel)]="tresorerie" placeholder="0" />
            <span class="aide">Utilisée par le bilan d'ouverture et le plan de trésorerie.</span>
          </label>
          <label class="case">
            <input type="checkbox" name="analyse" [(ngModel)]="avecAnalyse" />
            <span>Ajouter une analyse rédigée par l'IA<small>Les tableaux restent calculés par le code.</small></span>
          </label>
          @if (messageGlobal(); as m) {
            <div class="bandeau-erreur" role="alert">{{ m }}</div>
          }
          <button type="submit" class="btn-primaire" [disabled]="enCours()">
            {{ enCours() ? (avecAnalyse ? 'Génération et analyse…' : 'Génération…') : 'Générer le document' }}
          </button>
          <span class="note">Le document se base sur la prévision la plus récente du projet.</span>
        </form>
        }
      </div>
    </div>

    @if (aSupprimer(); as d) {
      <app-confirm-modal titre="Supprimer ce document ?" avant="Le document " [nom]="d.titre"
        apres=" et ses fichiers exportés seront supprimés définitivement." [enCours]="suppressionEnCours()"
        (confirmer)="supprimer(d)" (annuler)="aSupprimer.set(null)" />
    }
  `,
  styles: `
    .formulaire {
      flex: 1 1 300px;
      max-width: 380px;
    }
    .actions {
      white-space: nowrap;
    }
    .apercu {
      margin-top: 16px;
    }
    .section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .section h3 {
      font-size: 14px;
    }
    p.ia {
      background: #e3f0f1;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .certification {
      background: #e8f5ee;
      color: #1c5a3d;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .certification.a-faire {
      background: #fdf0dc;
      color: inherit;
    }
    .certification textarea {
      font: inherit;
      resize: vertical;
    }
  `,
})
export class DocumentsPage {
  protected readonly store = inject(FinanceStore);
  private readonly api = inject(FinanceApiService);
  private readonly notifications = inject(NotificationService);

  protected readonly types = TYPES_DOCUMENT;
  protected readonly libelle = libelleType;

  protected readonly documents = signal<DocumentResume[]>([]);
  protected readonly chargement = signal(false);
  protected readonly ouvert = signal<DocumentFinancier | null>(null);
  protected readonly enCours = signal(false);
  protected readonly messageGlobal = signal<string | null>(null);
  protected readonly export = signal<string | null>(null);
  protected readonly aSupprimer = signal<DocumentResume | null>(null);
  protected readonly suppressionEnCours = signal(false);

  protected commentaireCertification = '';
  protected readonly certificationEnCours = signal(false);

  protected type: TypeDocument = 'BUSINESS_PLAN';
  protected tresorerie: number | null = null;
  protected avecAnalyse = false;

  private readonly montantPipe = new MontantPipe();

  constructor() {
    effect(() => {
      const projetId = this.store.projetId();
      untracked(() => {
        this.ouvert.set(null);
        this.charger(projetId);
      });
    });
  }

  /**
   * Les taux ne sont pas des montants : le « % » figure soit dans la colonne (« Taux (%) », « % du CA »),
   * soit dans le libellé de la ligne (« Taux de marge brute (%) » du rapport investisseur).
   * Les montants s'affichent au centime, comme dans les exports PDF / Excel du même document.
   */
  protected valeur(colonne: string | undefined, libelle: string, valeur: number): string {
    return /%/.test(colonne ?? '') || /%/.test(libelle)
      ? `${valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
      : this.montantPipe.transform(valeur, 'centimes');
  }

  protected estAnalyse(titre: string): boolean {
    return titre.startsWith('Analyse');
  }

  private charger(projetId: number): void {
    this.chargement.set(true);
    this.api.listerDocuments(projetId).subscribe({
      next: (liste) => {
        this.documents.set(liste);
        this.chargement.set(false);
      },
      error: (e: unknown) => {
        this.documents.set([]);
        this.chargement.set(false);
        messageErreur(e, this.notifications);
      },
    });
  }

  protected generer(): void {
    this.messageGlobal.set(null);
    this.enCours.set(true);
    this.api
      .genererDocument({
        projetId: this.store.projetId(),
        type: this.type,
        tresorerieInitiale: this.tresorerie,
        avecAnalyse: this.avecAnalyse,
      })
      .subscribe({
        next: (document) => {
          this.notifications.succes('Document généré.');
          this.ouvert.set(document);
          this.charger(this.store.projetId());
          this.enCours.set(false);
        },
        error: (e: unknown) => {
          this.messageGlobal.set(texteErreur(e));
          this.enCours.set(false);
        },
      });
  }

  protected ouvrir(resume: DocumentResume): void {
    this.api.consulterDocument(resume.documentId).subscribe({
      next: (document) => this.ouvert.set(document),
      error: (e: unknown) => messageErreur(e, this.notifications),
    });
  }

  protected exporter(resume: DocumentResume, format: FormatExport): void {
    this.export.set(resume.documentId);
    this.api.exporterDocument(resume.documentId, format).subscribe({
      next: (reponse) => {
        const blob = reponse.body;
        if (blob) {
          telecharger(blob, nomFichier(reponse.headers.get('Content-Disposition')) ?? `${resume.documentId}.${format}`);
        }
        this.export.set(null);
      },
      error: (e: unknown) => {
        messageErreur(e, this.notifications);
        this.export.set(null);
      },
    });
  }

  protected certifier(document: DocumentFinancier): void {
    this.certificationEnCours.set(true);
    this.api.certifierDocument(document.documentId, this.commentaireCertification.trim() || null).subscribe({
      next: (certifie) => {
        this.ouvert.set(certifie);
        this.documents.update((liste) =>
          liste.map((d) => (d.documentId === certifie.documentId ? { ...d, certification: certifie.certification } : d)),
        );
        this.commentaireCertification = '';
        this.certificationEnCours.set(false);
        this.notifications.succes('Document certifié.');
      },
      error: (e: unknown) => {
        messageErreur(e, this.notifications);
        this.certificationEnCours.set(false);
      },
    });
  }

  protected supprimer(resume: DocumentResume): void {
    this.suppressionEnCours.set(true);
    this.api.supprimerDocument(resume.documentId).subscribe({
      next: () => {
        this.documents.update((liste) => liste.filter((d) => d.documentId !== resume.documentId));
        if (this.ouvert()?.documentId === resume.documentId) this.ouvert.set(null);
        this.aSupprimer.set(null);
        this.suppressionEnCours.set(false);
        this.notifications.succes('Document supprimé.');
      },
      error: (e: unknown) => {
        messageErreur(e, this.notifications);
        this.suppressionEnCours.set(false);
      },
    });
  }
}

function nomFichier(entete: string | null): string | null {
  const correspondance = entete?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return correspondance ? decodeURIComponent(correspondance[1]) : null;
}

function telecharger(blob: Blob, nom: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}
