type MappableEvent = {
  latitude?: number | null;
  longitude?: number | null;
  locationPrecision?: string | null;
};

export type EventMapLocation = { position: [number, number] };

export function eventMapLocation(event: MappableEvent): EventMapLocation | null {
  if (event.locationPrecision !== "exact" || event.latitude == null || event.longitude == null) return null;
  if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude) || Math.abs(event.latitude) > 90 || Math.abs(event.longitude) > 180) return null;
  return { position: [event.latitude, event.longitude] };
}
