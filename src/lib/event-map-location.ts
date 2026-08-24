type MappableEvent = {
  id: string;
  city?: string | null;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type EventMapLocation = { position: [number, number]; approximate: boolean };

const locations: Record<string, [number, number]> = {
  "arica": [-18.4783, -70.3126], "iquique": [-20.2141, -70.1524], "antofagasta": [-23.6509, -70.3975], "copiapo": [-27.3668, -70.3323], "la serena": [-29.9027, -71.2519], "coquimbo": [-29.9533, -71.3395],
  "valparaiso": [-33.0472, -71.6127], "vina del mar": [-33.0153, -71.5500], "santiago": [-33.4489, -70.6693], "providencia": [-33.4310, -70.6094], "la reina": [-33.4487, -70.5442], "huechuraba": [-33.3742, -70.6312], "independencia": [-33.4196, -70.6511], "la florida": [-33.5226, -70.5985],
  "rancagua": [-34.1708, -70.7444], "talca": [-35.4264, -71.6667], "chillan": [-36.6066, -72.1034], "concepcion": [-36.8270, -73.0503], "temuco": [-38.7359, -72.5904], "valdivia": [-39.8142, -73.2459], "puerto montt": [-41.4693, -72.9424], "coyhaique": [-45.5712, -72.0683], "punta arenas": [-53.1638, -70.9171],
  "arica y parinacota": [-18.4783, -70.3126], "tarapaca": [-20.2141, -70.1524], "atacama": [-27.3668, -70.3323], "ohiggins": [-34.1708, -70.7444], "maule": [-35.4264, -71.6667], "nuble": [-36.6066, -72.1034], "biobio": [-36.8270, -73.0503], "la araucania": [-38.7359, -72.5904], "los rios": [-39.8142, -73.2459], "los lagos": [-41.4693, -72.9424], "aysen": [-45.5712, -72.0683], "magallanes": [-53.1638, -70.9171], "metropolitana": [-33.4489, -70.6693],
};

function normalized(value?: string | null) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").trim();
}

function offset(id: string) {
  const value = [...id].reduce((total, character) => (total * 31 + character.codePointAt(0)!) % 10_000, 7);
  return ((value / 10_000) - 0.5) * 0.018;
}

export function eventMapLocation(event: MappableEvent): EventMapLocation | null {
  if (event.latitude != null && event.longitude != null) return { position: [event.latitude, event.longitude], approximate: false };
  const center = locations[normalized(event.city)] ?? locations[normalized(event.region)];
  if (!center) return null;
  const jitter = offset(event.id);
  return { position: [center[0] + jitter, center[1] - jitter], approximate: true };
}
