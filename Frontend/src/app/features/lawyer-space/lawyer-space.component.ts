import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { EspaceAvocatComponent } from './pages/avocat/espace-avocat.component';
import { EspaceEntrepreneurComponent } from './pages/entrepreneur/espace-entrepreneur.component';

/**
 * Page « Avocat » (/professional/avocat) : la vue dépend du rôle.
 *  - LAWYER : son cabinet (demandes reçues, messagerie, clients) ;
 *  - ENTREPRENEUR / ADMIN : annuaire des avocats, messagerie et suivi de ses demandes.
 * Données réelles : User-Service (annuaire) et les 3 services Lawyer-* via l'API Gateway
 * (voir services/avocat-api.service.ts).
 */
@Component({
  selector: 'app-lawyer-space',
  imports: [EspaceAvocatComponent, EspaceEntrepreneurComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (estAvocat) {
      <app-espace-avocat />
    } @else {
      <app-espace-avocat-entrepreneur />
    }
  `,
})
export class LawyerSpaceComponent {
  protected readonly estAvocat = inject(AuthService).currentUserValue?.role === 'LAWYER';
}
