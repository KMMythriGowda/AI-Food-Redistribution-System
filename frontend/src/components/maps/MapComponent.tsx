import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

interface MapComponentProps {
  donorLat?: number | null;
  donorLon?: number | null;
  donorName?: string;
  ngoLat?: number | null;
  ngoLon?: number | null;
  ngoName?: string;
  distanceKm?: number | null;
}

export const MapComponent: React.FC<MapComponentProps> = ({ donorLat, donorLon, donorName = 'Donor', ngoLat, ngoLon, ngoName = 'NGO', distanceKm }) => {
  const donorKnown = donorLat != null && donorLon != null;
  const ngoKnown = ngoLat != null && ngoLon != null;

  if (!donorKnown && !ngoKnown) {
    return (
      <div className="w-full h-[250px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-center p-6">
        <div><div className="text-2xl mb-2">📍</div><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Map coordinates are not available yet</p><p className="text-[11px] text-slate-500 mt-1">Add a recognizable city/address to the donor or NGO profile to calculate proximity.</p></div>
      </div>
    );
  }

  const dLat = donorLat ?? ngoLat ?? 22.5726;
  const dLon = donorLon ?? ngoLon ?? 88.3639;
  const nLat = ngoLat ?? donorLat ?? 22.5726;
  const nLon = ngoLon ?? donorLon ?? 88.3639;
  const center: [number, number] = [(dLat + nLat) / 2, (dLon + nLon) / 2];

  return (
    <div className="w-full h-[250px] rounded-2xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 relative z-0">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="w-full h-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {donorKnown && <Marker position={[dLat, dLon]}><Popup><div className="text-xs"><strong>{donorName}</strong><p>Surplus Pickup Location</p></div></Popup></Marker>}
        {ngoKnown && <Marker position={[nLat, nLon]}><Popup><div className="text-xs"><strong>{ngoName}</strong><p>Recipient Location</p></div></Popup></Marker>}
      </MapContainer>
      {distanceKm != null && <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 py-1.5 px-3 rounded-xl shadow-md text-xs font-bold text-slate-800 dark:text-white z-[400]">📍 Proximity Distance: {distanceKm} km</div>}
    </div>
  );
};

export default MapComponent;
