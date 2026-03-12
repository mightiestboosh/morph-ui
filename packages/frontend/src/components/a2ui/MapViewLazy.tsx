import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons (Leaflet + bundlers issue)
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface MarkerData {
  lat: number;
  lng: number;
  label?: string;
}

interface MapNode {
  markers?: MarkerData[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number | string;
}

interface MapViewLazyProps {
  node: MapNode & Record<string, unknown>;
  selectable?: boolean;
  onSelect?: (marker: Record<string, unknown>) => void;
}

export default function MapViewLazy({ node, selectable, onSelect }: MapViewLazyProps) {
  const markers = (node.markers as MarkerData[]) ?? [];
  const zoom = Number(node.zoom) || 12;
  const height = node.height ?? 400;

  // Determine center from props or markers
  let center: [number, number] = [40.7128, -74.006]; // NYC default
  if (node.center?.lat && node.center?.lng) {
    center = [node.center.lat, node.center.lng];
  } else if (markers.length > 0) {
    const avgLat = markers.reduce((s, m) => s + m.lat, 0) / markers.length;
    const avgLng = markers.reduce((s, m) => s + m.lng, 0) / markers.length;
    center = [avgLat, avgLng];
  }

  return (
    <div
      className="border border-border rounded-xl overflow-hidden"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        {markers.map((marker, i) => (
          <Marker
            key={i}
            position={[marker.lat, marker.lng]}
            eventHandlers={selectable && onSelect ? {
              click: () => onSelect({ ...marker }),
            } : undefined}
          >
            {marker.label && (
              <Popup>
                {selectable ? (
                  <button
                    className="text-sm font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                    onClick={() => onSelect?.({ ...marker })}
                  >
                    {marker.label} &rarr;
                  </button>
                ) : (
                  marker.label
                )}
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
