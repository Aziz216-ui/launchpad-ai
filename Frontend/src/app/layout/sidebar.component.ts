import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { environment } from '../../environments/environment';
import { IconComponent } from '../shared/components/icon.component';
import { AuthService } from '../core/services/auth.service';
import { MENU } from './menu';

/** Barre latérale commune : la liste des modules vient de layout/menu.ts, filtrée par rôle. */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly utilisateur = environment.utilisateur;

  protected readonly utilisateurConnecte = toSignal(this.authService.currentUser$, {
    initialValue: this.authService.currentUserValue,
  });

  protected readonly liens = computed(() => {
    const role = this.utilisateurConnecte()?.role;
    return MENU.filter((lien) => !lien.roles || (!!role && lien.roles.includes(role)));
  });

  /** L'encart « Échanger avec mon IA » n'a de sens que si le Co-Fondateur IA est dans le menu de l'utilisateur. */
  protected readonly accesCoFondateur = computed(() => this.liens().some((lien) => lien.route === '/co-fondateur-ia'));

  protected initiale(): string {
    const nom = this.utilisateurConnecte()?.username;
    return (nom?.charAt(0) || 'U').toUpperCase();
  }

  protected deconnexion(): void {
    this.authService.logout();
    this.router.navigate(['/connexion/login']);
  }
}
