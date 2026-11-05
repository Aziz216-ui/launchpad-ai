import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NotificationService } from '../../core/notifications/notification.service';
import { IconComponent } from './icon.component';

/** Affiche les toasts du NotificationService (en haut à droite). */
@Component({
  selector: 'app-toast-container',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pile" aria-live="polite">
      @for (n of notifications.notifications(); track n.id) {
        <div class="toast" [class]="n.type" [attr.role]="n.type === 'erreur' ? 'alert' : 'status'">
          <app-icon [nom]="n.type === 'succes' ? 'cercle-valide' : 'info'" [taille]="18" />
          <span>{{ n.message }}</span>
          <button type="button" aria-label="Fermer la notification" (click)="notifications.fermer(n.id)">
            <app-icon nom="fermer" [taille]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .pile {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 200;
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: min(380px, calc(100vw - 32px));
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 12px 12px 14px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e3e8ea;
      border-left: 4px solid #2b7a86;
      box-shadow: 0 12px 28px rgba(20, 40, 45, 0.14);
      font-size: 13px;
      line-height: 1.5;
      color: #1d2b2f;
    }
    .toast.succes {
      border-left-color: #24704c;
      app-icon {
        color: #24704c;
      }
    }
    .toast.erreur {
      border-left-color: #b23a3a;
      app-icon {
        color: #b23a3a;
      }
    }
    .toast.info app-icon {
      color: #1f6470;
    }
    span {
      flex: 1;
    }
    button {
      border: 0;
      background: transparent;
      color: #5a6a6f;
      cursor: pointer;
      padding: 2px;
    }
  `,
})
export class ToastContainerComponent {
  protected readonly notifications = inject(NotificationService);
}
