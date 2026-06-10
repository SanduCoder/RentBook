import { Component, input } from '@angular/core';

export type Icon3dName =
  | 'home'
  | 'properties'
  | 'requests'
  | 'more'
  | 'tenants'
  | 'expenses'
  | 'bills'
  | 'reports'
  | 'notifications'
  | 'caretakers'
  | 'language'
  | 'collected'
  | 'outstanding'
  | 'occupancy'
  | 'pending'
  | 'profile-scene';

let iconId = 0;

@Component({
  selector: 'app-icon-3d',
  standalone: true,
  template: `
    <svg
      class="icon-3d"
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient [attr.id]="gid('bg')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#EAF8F0" />
          <stop offset="100%" stop-color="#D8F1E4" />
        </linearGradient>
        <linearGradient [attr.id]="gid('main')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1FA463" />
          <stop offset="100%" stop-color="#0D7A48" />
        </linearGradient>
        <linearGradient [attr.id]="gid('light')" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#55D28F" />
          <stop offset="100%" stop-color="#34C27A" />
        </linearGradient>
        <linearGradient [attr.id]="gid('blue')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#60A5FA" />
          <stop offset="100%" stop-color="#2563EB" />
        </linearGradient>
        <linearGradient [attr.id]="gid('purple')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#C4B5FD" />
          <stop offset="100%" stop-color="#7C3AED" />
        </linearGradient>
        <linearGradient [attr.id]="gid('orange')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FDBA74" />
          <stop offset="100%" stop-color="#EA580C" />
        </linearGradient>
        <linearGradient [attr.id]="gid('yellow')" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FDE047" />
          <stop offset="100%" stop-color="#CA8A04" />
        </linearGradient>
        <filter [attr.id]="gid('shadow')" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0A7A47" flood-opacity="0.18" />
        </filter>
      </defs>

      @switch (name()) {
        @case ('home') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <path [attr.fill]="'url(#' + gid('main') + ')'" d="M148 250 256 148l108 102v114H148V250z" />
            <path [attr.fill]="'url(#' + gid('light') + ')'" d="M176 250 256 176l80 74v98H176V250z" opacity="0.55" />
            <rect x="220" y="300" width="72" height="78" rx="12" fill="#fff" />
            <rect x="236" y="316" width="40" height="46" rx="8" fill="#EAF8F0" />
          </g>
        }
        @case ('properties') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <rect x="128" y="170" width="90" height="190" rx="18" fill="#34C27A" />
            <rect x="220" y="120" width="110" height="240" rx="22" [attr.fill]="'url(#' + gid('main') + ')'" />
            <rect x="336" y="190" width="58" height="170" rx="18" fill="#55D28F" />
            <g fill="#E9F8F0">
              <rect x="150" y="196" width="18" height="18" rx="4" />
              <rect x="180" y="196" width="18" height="18" rx="4" />
              <rect x="150" y="232" width="18" height="18" rx="4" />
              <rect x="180" y="232" width="18" height="18" rx="4" />
              <rect x="246" y="154" width="22" height="22" rx="4" />
              <rect x="286" y="154" width="22" height="22" rx="4" />
              <rect x="246" y="196" width="22" height="22" rx="4" />
              <rect x="286" y="196" width="22" height="22" rx="4" />
              <rect x="246" y="238" width="22" height="22" rx="4" />
              <rect x="286" y="238" width="22" height="22" rx="4" />
            </g>
            <rect x="258" y="296" width="34" height="64" rx="10" fill="#fff" />
          </g>
        }
        @case ('requests') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <rect x="156" y="132" width="200" height="248" rx="24" fill="#fff" />
            <rect x="156" y="132" width="200" height="56" rx="24" [attr.fill]="'url(#' + gid('main') + ')'" />
            <rect x="196" y="220" width="120" height="16" rx="8" fill="#D8F1E4" />
            <rect x="196" y="256" width="96" height="16" rx="8" fill="#D8F1E4" />
            <rect x="196" y="292" width="108" height="16" rx="8" fill="#D8F1E4" />
            <circle cx="332" cy="160" r="18" [attr.fill]="'url(#' + gid('light') + ')'" />
          </g>
        }
        @case ('more') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <circle cx="176" cy="256" r="34" [attr.fill]="'url(#' + gid('main') + ')'" />
            <circle cx="256" cy="256" r="34" [attr.fill]="'url(#' + gid('light') + ')'" />
            <circle cx="336" cy="256" r="34" fill="#34C27A" />
            <circle cx="168" cy="248" r="10" fill="#fff" opacity="0.35" />
            <circle cx="248" cy="248" r="10" fill="#fff" opacity="0.35" />
            <circle cx="328" cy="248" r="10" fill="#fff" opacity="0.35" />
          </g>
        }
        @case ('tenants') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <circle cx="196" cy="196" r="42" [attr.fill]="'url(#' + gid('purple') + ')'" />
            <path [attr.fill]="'url(#' + gid('purple') + ')'" d="M124 360c8-52 48-78 72-78s64 26 72 78H124z" />
            <circle cx="316" cy="210" r="36" fill="#34C27A" />
            <path fill="#1FA463" d="M252 360c6-44 40-66 64-66s58 22 64 66H252z" />
          </g>
        }
        @case ('expenses') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <path [attr.fill]="'url(#' + gid('orange') + ')'" d="M148 128h176l48 48v208H148V128z" />
            <path fill="#FDBA74" d="M324 128v48h48l-48-48z" />
            <rect x="188" y="220" width="136" height="18" rx="9" fill="#fff" opacity="0.85" />
            <rect x="188" y="258" width="108" height="18" rx="9" fill="#fff" opacity="0.7" />
            <rect x="188" y="296" width="120" height="18" rx="9" fill="#fff" opacity="0.55" />
          </g>
        }
        @case ('bills') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <path [attr.fill]="'url(#' + gid('blue') + ')'" d="M256 132c-72 88-108 148-108 196a108 108 0 00216 0c0-48-36-108-108-196z" />
            <path fill="#93C5FD" d="M256 168c-48 58-72 98-72 132a72 72 0 00144 0c0-34-24-74-72-132z" opacity="0.55" />
            <ellipse cx="230" cy="196" rx="18" ry="28" fill="#fff" opacity="0.25" />
          </g>
        }
        @case ('reports') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <rect x="148" y="300" width="64" height="96" rx="14" fill="#34C27A" />
            <rect x="224" y="236" width="64" height="160" rx="14" [attr.fill]="'url(#' + gid('main') + ')'" />
            <rect x="300" y="268" width="64" height="128" rx="14" [attr.fill]="'url(#' + gid('purple') + ')'" />
          </g>
        }
        @case ('notifications') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <path [attr.fill]="'url(#' + gid('yellow') + ')'" d="M256 124c-62 0-98 50-98 108v58l-28 36h252l-28-36v-58c0-58-36-108-98-108z" />
            <circle cx="256" cy="360" r="28" fill="#F59E0B" />
            <ellipse cx="220" cy="168" rx="20" ry="30" fill="#fff" opacity="0.28" />
          </g>
        }
        @case ('caretakers') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <circle cx="256" cy="188" r="52" [attr.fill]="'url(#' + gid('purple') + ')'" />
            <path [attr.fill]="'url(#' + gid('purple') + ')'" d="M148 372c12-72 68-108 108-108s96 36 108 108H148z" />
            <rect x="312" y="148" width="56" height="56" rx="16" fill="#34C27A" />
            <path d="M328 176h24M340 164v24" stroke="#fff" stroke-width="8" stroke-linecap="round" />
          </g>
        }
        @case ('language') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <circle cx="256" cy="256" r="108" [attr.fill]="'url(#' + gid('blue') + ')'" />
            <ellipse cx="256" cy="256" rx="108" ry="42" stroke="#fff" stroke-width="10" opacity="0.55" />
            <path d="M256 148v216M148 256h216" stroke="#fff" stroke-width="10" opacity="0.45" />
            <ellipse cx="220" cy="220" rx="24" ry="40" fill="#fff" opacity="0.2" />
          </g>
        }
        @case ('collected') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <rect x="124" y="196" width="264" height="164" rx="24" [attr.fill]="'url(#' + gid('main') + ')'" />
            <rect x="124" y="228" width="264" height="36" fill="#0D7A48" opacity="0.35" />
            <rect x="156" y="292" width="72" height="20" rx="10" fill="#EAF8F0" />
            <rect x="156" y="324" width="108" height="16" rx="8" fill="#55D28F" />
          </g>
        }
        @case ('outstanding') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <rect x="148" y="300" width="56" height="88" rx="12" fill="#FDBA74" />
            <rect x="228" y="252" width="56" height="136" rx="12" [attr.fill]="'url(#' + gid('orange') + ')'" />
            <rect x="308" y="276" width="56" height="112" rx="12" fill="#F97316" />
            <path d="M136 300h240" stroke="#0D7A48" stroke-width="10" stroke-linecap="round" opacity="0.2" />
          </g>
        }
        @case ('occupancy') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <path [attr.fill]="'url(#' + gid('light') + ')'" d="M156 250 256 156l100 94v118H156V250z" />
            <path [attr.fill]="'url(#' + gid('main') + ')'" d="M188 250 256 188l68 62v94H188V250z" />
            <rect x="224" y="296" width="64" height="72" rx="10" fill="#fff" />
            <circle cx="340" cy="196" r="28" fill="#34C27A" />
            <path d="M328 196h24M340 184v24" stroke="#fff" stroke-width="6" stroke-linecap="round" />
          </g>
        }
        @case ('pending') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <rect x="160" y="136" width="192" height="240" rx="22" fill="#fff" />
            <rect x="160" y="136" width="192" height="52" rx="22" [attr.fill]="'url(#' + gid('yellow') + ')'" />
            <circle cx="352" cy="162" r="22" fill="#EF4444" />
            <rect x="196" y="220" width="120" height="14" rx="7" fill="#D8F1E4" />
            <rect x="196" y="252" width="96" height="14" rx="7" fill="#D8F1E4" />
            <rect x="196" y="284" width="108" height="14" rx="7" fill="#D8F1E4" />
          </g>
        }
        @case ('profile-scene') {
          <circle cx="256" cy="256" r="180" [attr.fill]="'url(#' + gid('bg') + ')'" />
          <g [attr.filter]="'url(#' + gid('shadow') + ')'">
            <path [attr.fill]="'url(#' + gid('light') + ')'" d="M72 332c48-72 96-96 184-96s136 24 184 96v52H72v-52z" opacity="0.85" />
            <path fill="#34C27A" d="M96 348c36-48 72-64 160-64s124 16 160 64v36H96v-36z" />
            <path [attr.fill]="'url(#' + gid('main') + ')'" d="M168 196 228 148l60 48v128h-120V196z" />
            <path fill="#55D28F" d="M192 196 228 168l36 28v80h-72V196z" opacity="0.55" />
            <rect x="204" y="252" width="48" height="72" rx="10" fill="#fff" />
            <rect x="276" y="220" width="72" height="104" rx="12" fill="#34C27A" />
            <rect x="292" y="244" width="18" height="18" rx="4" fill="#E9F8F0" />
            <rect x="318" y="244" width="18" height="18" rx="4" fill="#E9F8F0" />
            <rect x="292" y="276" width="18" height="18" rx="4" fill="#E9F8F0" />
            <rect x="318" y="276" width="18" height="18" rx="4" fill="#E9F8F0" />
            <rect x="356" y="248" width="52" height="76" rx="10" fill="#1FA463" />
            <circle cx="132" cy="248" r="28" [attr.fill]="'url(#' + gid('light') + ')'" />
            <circle cx="120" cy="236" r="10" fill="#fff" opacity="0.3" />
          </g>
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }

    .icon-3d {
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
})
export class Icon3dComponent {
  name = input.required<Icon3dName>();

  private readonly prefix = `i3d-${++iconId}`;

  gid(suffix: string): string {
    return `${this.prefix}-${suffix}`;
  }
}
