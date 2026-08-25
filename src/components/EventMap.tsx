"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { EventCard } from "@/lib/events";
import { eventMapLocation, type EventMapLocation } from "@/lib/event-map-location";

const marker = L.divIcon({
  className: "event-marker",
  html: '<span aria-hidden="true"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export function EventMap({ events }: { events: EventCard[] }) {
  const located = events.flatMap((event) => {
    const location = eventMapLocation(event);
    return location ? [{ event, location }] : [];
  });
  const pending = events.length - located.length;

  return (
    <div className="map-shell">
      <MapContainer center={[-33.45, -70.66]} zoom={5} scrollWheelZoom className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport locations={located.map(({ location }) => location)} />
        {located.map(({ event, location }) => (
          <Marker key={event.id} position={location.position} icon={marker}>
            <Popup>
              <strong>{event.title}</strong>
              <br />
              {[event.venue, event.address, event.city].filter(Boolean).join(", ")}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="map-count"><b>{located.length}</b> ubicaciones exactas{pending > 0 ? `, ${pending} pendientes de verificar` : ""}</div>
    </div>
  );
}

function MapViewport({ locations }: { locations: EventMapLocation[] }) {
  const map = useMap();
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      map.invalidateSize();
      if (locations.length === 1) map.setView(locations[0].position, 12);
      else if (locations.length > 1) map.fitBounds(L.latLngBounds(locations.map((location) => location.position)), { padding: [36, 36], maxZoom: 10 });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [locations, map]);
  return null;
}
