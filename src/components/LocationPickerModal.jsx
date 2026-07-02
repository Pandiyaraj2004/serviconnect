import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { X, MapPin, Navigation, Search } from 'lucide-react';
import L from 'leaflet';
import toast from 'react-hot-toast';

// Leaflet default icons configuration
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function MapClickHandler({ handlePositionChange }) {
  const map = useMapEvents({
    click(e) {
      handlePositionChange(e.latlng.lat, e.latlng.lng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });
  return null;
}

function ChangeMapCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

const LocationPickerModal = ({ isOpen, onClose, onSave, initialLat, initialLng, initialAddress }) => {
  const defaultLat = 19.076;
  const defaultLng = 72.877;
  
  const [position, setPosition] = useState([
    initialLat || defaultLat,
    initialLng || defaultLng
  ]);
  const [address, setAddress] = useState(initialAddress || '');
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locationInfo, setLocationInfo] = useState({ city: '', district: '', state: '', country: '' });

  useEffect(() => {
    if (initialLat && initialLng) {
      setPosition([initialLat, initialLng]);
    }
    if (initialAddress) {
      setAddress(initialAddress);
    }
  }, [initialLat, initialLng, initialAddress]);

  if (!isOpen) return null;

  const handlePositionChange = async (lat, lng) => {
    setPosition([lat, lng]);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'ServiConnect-App' }
      });
      const data = await res.json();
      if (data && data.display_name) {
        const a = data.address;
        const parts = [];
        let city = '';
        let district = '';
        let state = '';
        let country = '';
        if (a) {
          if (a.road) parts.push(a.road);
          if (a.suburb) parts.push(a.suburb);
          else if (a.neighbourhood) parts.push(a.neighbourhood);
          if (a.city || a.town || a.village) parts.push(a.city || a.town || a.village);
          if (a.state) parts.push(a.state);

          city = a.city || a.town || a.village || a.suburb || '';
          district = a.county || a.state_district || a.district || '';
          state = a.state || '';
          country = a.country || '';
        }
        const cleanAddr = parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(', ');
        setAddress(cleanAddr);
        setLocationInfo({ city, district, state, country });
      }
    } catch (err) {
      console.warn('Map pick reverse geocode error:', err);
    }
  };

  const handleMapSearch = async () => {
    if (!mapSearchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}&limit=1&addressdetails=1`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'ServiConnect-App' }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        setPosition([lat, lng]);
        setAddress(item.display_name);
        
        const a = item.address;
        const city = a ? (a.city || a.town || a.village || a.suburb || '') : '';
        const district = a ? (a.county || a.state_district || a.district || '') : '';
        const state = a ? (a.state || '') : '';
        const country = a ? (a.country || '') : '';
        setLocationInfo({ city, district, state, country });
        
        toast.success(`Found: ${item.display_name.split(',')[0]}`);
      } else {
        toast.error('Location not found');
      }
    } catch (err) {
      console.warn('Map modal search error:', err);
      toast.error('Error searching location');
    } finally {
      setSearching(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        handlePositionChange(latitude, longitude);
        setLoadingGeo(false);
        toast.success('Location detected!');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        toast.error('Unable to retrieve location. Please pin manually on map.');
        setLoadingGeo(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleSave = () => {
    if (!address.trim()) {
      toast.error('Please enter your manual address/neighborhood name');
      return;
    }
    onSave({
      lat: position[0],
      lng: position[1],
      address: address.trim(),
      city: locationInfo.city,
      district: locationInfo.district,
      state: locationInfo.state,
      country: locationInfo.country
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-card w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 relative z-20">
          <div className="flex items-center gap-2 text-primary-light dark:text-primary-dark">
            <MapPin size={20} />
            <h3 className="font-bold text-gray-900 dark:text-white text-lg">Select Location</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-650 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 relative z-10">
          {/* Map search input */}
          <div className="space-y-1 relative z-20">
            <label className="text-[10px] font-bold text-gray-455 dark:text-gray-400 uppercase tracking-wider block">Search Location on Map</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={mapSearchQuery}
                  onChange={(e) => setMapSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMapSearch(); } }}
                  placeholder="Type city, area or street name..."
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs rounded-lg outline-none focus:border-primary-light"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              </div>
              <button
                type="button"
                onClick={handleMapSearch}
                disabled={searching}
                className="px-3 py-2 bg-primary-light text-white text-xs font-bold rounded-lg shrink-0 hover:bg-primary-light/95 transition-colors disabled:opacity-70"
              >
                {searching ? 'Finding...' : 'Search'}
              </button>
            </div>
          </div>

          {/* Map area */}
          <div className="h-64 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 relative z-0">
            <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker 
                position={position}
                draggable={true}
                eventHandlers={{
                  dragend(e) {
                    const marker = e.target;
                    const pos = marker.getLatLng();
                    handlePositionChange(pos.lat, pos.lng);
                  }
                }}
              />
              <MapClickHandler handlePositionChange={handlePositionChange} />
              <ChangeMapCenter center={position} />
            </MapContainer>
            
            {/* Float detect button */}
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={loadingGeo}
              className="absolute bottom-4 right-4 z-[1000] p-2 bg-primary-light dark:bg-primary-dark text-white rounded-full shadow-lg hover:scale-105 transition-transform flex items-center gap-1.5 text-xs font-semibold disabled:opacity-80"
            >
              <Navigation size={14} className={loadingGeo ? 'animate-spin' : ''} />
              Detect Location
            </button>
          </div>

          <div className="text-[10px] text-gray-400 dark:text-gray-500 flex justify-between px-1 font-semibold relative z-10">
            <span>Latitude: {position[0].toFixed(5)}</span>
            <span>Longitude: {position[1].toFixed(5)}</span>
          </div>

          {/* Manual Address Entry */}
          <div className="space-y-1.5 relative z-10">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">Manual Address / Landmark / Neighborhood *</label>
            <textarea
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter details like building number, street name, city, landmark..."
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-input text-sm text-gray-900 dark:text-white outline-none focus:border-primary-light dark:focus:border-primary-dark resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 flex gap-3 shrink-0 relative z-20">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-button text-sm animate-click"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-primary-light dark:bg-primary-dark text-white font-bold rounded-button text-sm animate-click"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPickerModal;
