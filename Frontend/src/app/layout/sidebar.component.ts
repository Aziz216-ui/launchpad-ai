import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { environment } from '../../environments/environment';
import { IconComponent } from '../shared/components/icon.component';
import { MENU } from './menu';

/** Barre latérale commune : la liste des modules vient de layout/menu.ts. */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  protected readonly utilisateur = environment.utilisateur;
  protected readonly liens = MENU;
}
