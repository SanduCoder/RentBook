export type PropertyType = 'compound' | 'apartment' | 'room' | 'shop' | 'office';

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  compound: 'Compound',
  apartment: 'Apartment',
  room: 'Room',
  shop: 'Shop',
  office: 'Office',
};

export interface Property {
  id: string;
  ownerId: string;
  name: string;
  type: PropertyType;
  address: string;
  country: string;
  countryCode?: string;
  currency: string;
  totalUnits: number;
  imageUrl?: string;
  imageUrls?: string[];
  inviteCode?: string;
  createdAt: Date;
}
