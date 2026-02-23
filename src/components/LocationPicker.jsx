import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FiMapPin, FiNavigation, FiSearch } from 'react-icons/fi';

// Fix Leaflet default marker icon issue with bundlers
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Sub-component to handle map click events
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    },
  });
  return null;
}

export default function LocationPicker({ onLocationSelect, initialAddress = '' }) {
  // Default center: Nairobi, Kenya
  const [position, setPosition] = useState(null);
  const [address, setAddress] = useState(initialAddress);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef(null);

  // Reverse geocode: lat/lng → address
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data.display_name) {
        setAddress(data.display_name);
        if (onLocationSelect) {
          onLocationSelect({
            lat, lng,
            address: data.display_name,
          });
        }
      }
    } catch {
      // Use coordinates as fallback
      const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setAddress(fallback);
      if (onLocationSelect) {
        onLocationSelect({ lat, lng, address: fallback });
      }
    }
  };

  // Forward geocode: search text → lat/lng
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=ke&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const results = await res.json();
      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lon);
        setPosition({ lat: latNum, lng: lngNum });
        setAddress(display_name);
        if (mapRef.current) {
          mapRef.current.flyTo([latNum, lngNum], 16);
        }
        if (onLocationSelect) {
          onLocationSelect({ lat: latNum, lng: lngNum, address: display_name });
        }
      } else {
        setAddress('Location not found. Try tapping the map.');
      }
    } catch {
      setAddress('Search failed. Try tapping the map.');
    } finally {
      setSearching(false);
    }
  };

  // Handle map click
  const handleMapClick = (latlng) => {
    setPosition(latlng);
    reverseGeocode(latlng.lat, latlng.lng);
  };

  // Use device GPS
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setAddress('Geolocation not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPosition({ lat, lng });
        if (mapRef.current) {
          mapRef.current.flyTo([lat, lng], 16);
        }
        reverseGeocode(lat, lng);
        setLocating(false);
      },
      () => {
        setAddress('Could not get your location. Please search or tap the map.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Auto-detect location on mount
  useEffect(() => {
    if (!initialAddress) {
      handleUseMyLocation();
    }
  }, []);

  return (
    <div className="location-picker">
      {/* Search bar */}
      <form className="location-search" onSubmit={handleSearch}>
        <FiSearch />
        <input
          type="text"
          placeholder="Search for a place or area..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="submit" disabled={searching}>
          {searching ? '...' : 'Search'}
        </button>
      </form>

      {/* Map */}
      <div className="map-container">
        <MapContainer
          center={[-1.2921, 36.8219]} // Nairobi default
          zoom={13}
          style={{ height: '100%', width: '100%', borderRadius: '8px' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onLocationSelect={handleMapClick} />
          {position && <Marker position={[position.lat, position.lng]} icon={markerIcon} />}
        </MapContainer>
      </div>

      {/* Controls */}
      <div className="location-controls">
        <button
          type="button"
          className="btn-locate"
          onClick={handleUseMyLocation}
          disabled={locating}
        >
          <FiNavigation /> {locating ? 'Locating...' : 'Use My Location'}
        </button>
      </div>

      {/* Selected address */}
      {address && (
        <div className="selected-location">
          <FiMapPin />
          <span>{address}</span>
        </div>
      )}
    </div>
  );
}
