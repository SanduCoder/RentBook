const AVATAR_PALETTE = [
  { bg: '#dbeafe', fg: '#1d4ed8' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#ede9fe', fg: '#6d28d9' },
  { bg: '#ffedd5', fg: '#c2410c' },
  { bg: '#ccfbf1', fg: '#0f766e' },
  { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#e0e7ff', fg: '#4338ca' },
  { bg: '#fecdd3', fg: '#be123c' },
] as const;

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return (parts[0]?.charAt(0) ?? '?').toUpperCase();
}

export function getAvatarColors(seed: string): { background: string; color: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
  return { background: palette.bg, color: palette.fg };
}
