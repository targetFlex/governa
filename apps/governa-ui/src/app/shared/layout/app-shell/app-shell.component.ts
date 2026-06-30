import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

interface NavItem {
  label: string;
  path:  string;
  // Heroicons outline 24px — path data only
  svgPath: string;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path:  '/dashboard',
    exact: true,
    svgPath: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  },
  {
    label: 'Agentes',
    path:  '/agentes',
    svgPath: 'M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z',
  },
  {
    label: 'Alertas',
    path:  '/alertas',
    svgPath: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  },
  {
    label: 'Auditoria',
    path:  '/auditoria',
    svgPath: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  },
  {
    label: 'Clientes',
    path:  '/clientes',
    svgPath: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  },
  {
    label: 'Pedidos',
    path:  '/pedidos',
    svgPath: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  },
];

@Component({
  selector: 'gov-app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">

      <!-- ── Sidebar ──────────────────────────────────────── -->
      <aside class="sidebar" aria-label="Navegação principal">

        <!-- Brand -->
        <div class="sidebar__brand" aria-label="AICOCKPIT">
          <span class="sidebar__brand-icon" aria-hidden="true">◈</span>
          <span class="sidebar__brand-name">AICOCKPIT</span>
        </div>

        <!-- Nav -->
        <nav class="sidebar__nav">
          <ul role="list">
            @for (item of navItems; track item.path) {
              <li>
                <a
                  [routerLink]="item.path"
                  routerLinkActive="sidebar__link--active"
                  [routerLinkActiveOptions]="{ exact: !!item.exact }"
                  class="sidebar__link"
                  [attr.aria-label]="item.label"
                >
                  <svg
                    class="sidebar__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                  >
                    <path [attr.d]="item.svgPath" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span class="sidebar__label">{{ item.label }}</span>
                </a>
              </li>
            }
          </ul>
        </nav>

        <!-- Footer / logout -->
        <div class="sidebar__footer">
          <button
            type="button"
            class="sidebar__logout"
            aria-label="Encerrar sessão"
            (click)="logout()"
          >
            <svg class="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span class="sidebar__label">Sair</span>
          </button>
        </div>

      </aside>

      <!-- ── Conteúdo ─────────────────────────────────────── -->
      <main class="shell__content" id="main-content" tabindex="-1">
        <router-outlet />
      </main>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
    }

    .shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Sidebar ─────────────────────────────────────────── */
    .sidebar {
      width: 240px;
      flex-shrink: 0;
      background: var(--gov-color-primary-900);
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow-y: auto;
    }

    /* Brand */
    .sidebar__brand {
      display: flex;
      align-items: center;
      gap: var(--gov-space-3);
      padding: var(--gov-space-6) var(--gov-space-5);
      border-bottom: 1px solid rgb(255 255 255 / 0.08);
    }

    .sidebar__brand-icon {
      font-size: 1.5rem;
      color: var(--gov-color-primary-300);
      line-height: 1;
    }

    .sidebar__brand-name {
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-bold);
      letter-spacing: 0.08em;
      color: var(--gov-color-white);
      text-transform: uppercase;
    }

    /* Nav */
    .sidebar__nav {
      flex: 1;
      padding: var(--gov-space-4) var(--gov-space-3);

      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--gov-space-1);
      }
    }

    .sidebar__link {
      display: flex;
      align-items: center;
      gap: var(--gov-space-3);
      padding: var(--gov-space-2) var(--gov-space-3);
      border-radius: var(--gov-radius-md);
      color: var(--gov-color-primary-200);
      text-decoration: none;
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
      transition: background var(--gov-transition-fast), color var(--gov-transition-fast);

      &:hover {
        background: rgb(255 255 255 / 0.08);
        color: var(--gov-color-white);
      }

      &:focus-visible {
        outline: 2px solid var(--gov-color-primary-300);
        outline-offset: 1px;
      }
    }

    .sidebar__link--active {
      background: var(--gov-color-primary-700);
      color: var(--gov-color-white);

      &:hover {
        background: var(--gov-color-primary-600);
      }
    }

    .sidebar__icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .sidebar__label {
      flex: 1;
    }

    /* Footer */
    .sidebar__footer {
      padding: var(--gov-space-3);
      border-top: 1px solid rgb(255 255 255 / 0.08);
    }

    .sidebar__logout {
      display: flex;
      align-items: center;
      gap: var(--gov-space-3);
      width: 100%;
      padding: var(--gov-space-2) var(--gov-space-3);
      border-radius: var(--gov-radius-md);
      background: transparent;
      border: none;
      color: var(--gov-color-primary-200);
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
      cursor: pointer;
      text-align: left;
      transition: background var(--gov-transition-fast), color var(--gov-transition-fast);

      &:hover {
        background: rgb(239 68 68 / 0.15);
        color: #fca5a5;
      }

      &:focus-visible {
        outline: 2px solid var(--gov-color-primary-300);
        outline-offset: 1px;
      }
    }

    /* ── Conteúdo principal ──────────────────────────────── */
    .shell__content {
      flex: 1;
      overflow-y: auto;
      background: var(--gov-color-bg);
    }
  `],
})
export class AppShellComponent {
  protected readonly auth     = inject(AuthService);
  protected readonly navItems = NAV_ITEMS;

  logout(): void {
    this.auth.logout();
  }
}
