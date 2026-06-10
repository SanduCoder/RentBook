export type InviteCodeType = 'owner' | 'property';

export interface InviteCode {
  id: string;
  type: InviteCodeType;
  ownerId: string;
  ownerName: string;
  propertyId?: string;
  propertyName?: string;
  active: boolean;
  createdAt: Date;
}

export interface RedeemInviteResult {
  type: InviteCodeType;
  ownerId: string;
  propertyId?: string;
  tenantRecordId?: string;
  pendingAssignment: boolean;
}

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function secureRandomChar(): string {
  const index = crypto.getRandomValues(new Uint32Array(1))[0] % CODE_CHARS.length;
  return CODE_CHARS[index];
}

export function generateInviteCode(): string {
  const part = (length: number) =>
    Array.from({ length }, () => secureRandomChar()).join('');
  return `${part(3)}-${part(4)}`;
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function formatInviteCodeInput(value: string): string {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length <= 3) return raw;
  return `${raw.slice(0, 3)}-${raw.slice(3, 7)}`;
}
