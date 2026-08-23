"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import type { EventCard } from "@/lib/events";

const marker = L.divIcon({
  className: "event-marker",
  html: '<span aria-hidden="true"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export function EventMap({ events }: { events: EventCard[] }) {
  const located = events.filter((event) => event.latitude != null && event.longitude != null);

  return (
    <div className="map-shell">
      <MapContainer center={[-33.45, -70.66]} zoom={5} scrollWheelZoom className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((event) => (
          <Marker key={event.id} position={[event.latitude!, event.longitude!]} icon={marker}>
            <Popup>
              <strong>{event.title}</strong>
              <br />
              {event.city} · {event.venue}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="map-count"><b>{located.length}</b> lugares encontrados</div>
    </div>
  );
}
