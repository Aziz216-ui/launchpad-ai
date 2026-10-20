import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { HeaderComponent } from './header.component';
import { SidebarComponent } from './sidebar.component';

/**
 * Mise en page commune : barre latérale + en-tête + contenu du module.
 * Le `flex-wrap` des maquettes fait passer la barre au-dessus du contenu sur mobile.
 */
@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-sidebar />
    <main>
      <app-header />
      <router-outlet />
    </main>
  `,
  styles: `
    :host {
      min-height: 100vh;
      display: flex;
      flex-wrap: wrap;
      background: #f4f6f7;
    }
    main {
      flex: 999 1 560px;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
  `,
})
export class AppLayoutComponent {}
