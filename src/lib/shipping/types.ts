export type PickupPointType = 'RELAY_POINT' | 'LOCKER' | 'UNKNOWN';

export type PickupPoint = {
  provider: 'MONDIAL_RELAY';
  id: string;
  type: PickupPointType;
  name: string;
  address1: string;
  address2: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  distanceM: number | null;
  openingHours: Record<string, string[]> | null;
};

export type PickupPointSearch = {
  countryCode: string;
  postalCode: string;
  city?: string;
  pointId?: string;
  limit?: number;
};

export type ShipmentAddress = {
  name: string;
  company?: string | null;
  address1: string;
  address2?: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  phone?: string | null;
  email: string;
};

export type CreateShipmentInput = {
  orderNumber: string;
  customerReference: string;
  weightGrams: number;
  recipient: ShipmentAddress;
  pickupPoint: PickupPoint;
};

export type CreatedShipment = {
  providerShipmentId: string;
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;
};

export type ProviderTrackingEvent = {
  providerKey: string;
  label: string;
  location: string | null;
  occurredAt: Date | null;
};

export type ShipmentTracking = {
  summary: string;
  events: ProviderTrackingEvent[];
};

export interface ShippingProvider {
  searchPickupPoints(input: PickupPointSearch): Promise<PickupPoint[]>;
  getPickupPoint(pointId: string, countryCode: string): Promise<PickupPoint>;
  createShipment(input: CreateShipmentInput): Promise<CreatedShipment>;
  getTracking(providerShipmentId: string): Promise<ShipmentTracking>;
}
