import { readFileSync, writeFileSync } from 'fs';

function nestPageScss(inPath, outPath, className) {
  const lines = readFileSync(inPath, 'utf8').split(/\r?\n/);
  let start = 0;
  if (lines[0]?.trim().startsWith(`${className} {`)) {
    let depth = 0;
    for (let i = 0; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      if (depth === 0 && i > 0) {
        start = i + 1;
        break;
      }
    }
  }
  const body = lines
    .slice(start)
    .map((line) => line.replace(/:host ::ng-deep /g, `${className} `))
    .map((line) => `  ${line}`);
  writeFileSync(outPath, `${className} {\n${body.join('\n')}\n}\n`);
}

const root = 'src/app';
const pages = [
  ['features/dashboard/dashboard.component.scss', 'shared/styles/dashboard-page.scss', '.dashboard'],
  ['features/properties/property-list/property-list.component.scss', 'shared/styles/properties-page.scss', '.properties-page'],
  ['features/maintenance/maintenance-list/maintenance-list.component.scss', 'shared/styles/maintenance-page.scss', '.maintenance-page'],
  ['features/tenants/tenant-list/tenant-list.component.scss', 'shared/styles/tenants-page.scss', '.tenants-page'],
  ['features/tenants/tenant-detail/tenant-detail.component.scss', 'shared/styles/tenant-detail-page.scss', '.tenant-detail'],
];

for (const [src, dest, cls] of pages) {
  nestPageScss(`${root}/${src}`, `${root}/${dest}`, cls);
}
