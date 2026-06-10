export type UnitStatus = 'occupied' | 'vacant' | 'maintenance';

export type UnitType = 'room' | 'apartment' | 'shop' | 'office';

export interface Unit {
  id: string;
  propertyId: string;
  name: string;
  type: UnitType | string;
  rooms: number;
  bathrooms: number;
  monthlyRent: number;
  status: UnitStatus;
}

export const UNIT_TYPES: { value: UnitType; label: string }[] = [
  { value: 'room', label: 'Room' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'shop', label: 'Shop' },
  { value: 'office', label: 'Office' },
];

export function formatUnitLayout(rooms = 1, bathrooms = 1): string {
  const roomText = rooms === 1 ? '1 room' : `${rooms} rooms`;
  const bathText = bathrooms === 1 ? '1 bathroom' : `${bathrooms} bathrooms`;
  return `${roomText} · ${bathText}`;
}
