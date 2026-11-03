import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Indicateur de chargement. */
@Component({
  selector: 'app-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-live="polite">
      <span class="roue" aria-hidden="true"></span>
      <span>{{ texte() }}</span>
    </div>
  `,
  styles: `
    div {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 48px 16px;
      font-size: 13px;
      color: #5a6a6f;
    }
    .roue {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 3px solid #e3f0f1;
      border-top-color: #2b7a86;
      animation: tourner 0.8s linear infinite;
    }
    @keyframes tourner {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class LoaderComponent {
  readonly texte = input('Chargement…');
}
