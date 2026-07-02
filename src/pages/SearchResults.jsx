import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Map, List, Star, Filter, SlidersHorizontal, ChevronDown, Navigation, X, Search, ShieldCheck } from 'lucide-react';
import { SERVICE_CATEGORIES, INDIAN_CITIES, getDistance, formatImageUrl } from '../utils/helpers';
import { StaggerContainer, StaggerItem, Badge, EmptyState } from '../components/UI';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import LocationPickerModal from '../components/LocationPickerModal';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const POPULAR_CITIES = [
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
];

const CITY_COORDINATES = {
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'hyderabad': { lat: 17.3850, lng: 78.4867 },
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'coimbatore': { lat: 11.0168, lng: 76.9558 },
  'pune': { lat: 18.5204, lng: 73.8567 },
  'kolkata': { lat: 22.5726, lng: 88.3639 }
};

// Subcomponent to center Leaflet Map dynamically
function ChangeMapCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

const SearchResults = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('category') || '';
  const initialQuery = searchParams.get('q') || '';
  const { userProfile, updateUserProfile, user } = useAuth();

  // Location State
  const [userLat, setUserLat] = useState(userProfile?.lat || parseFloat(localStorage.getItem('user_lat')) || 19.076);
  const [userLng, setUserLng] = useState(userProfile?.lng || parseFloat(localStorage.getItem('user_lng')) || 72.877);
  const [userAddress, setUserAddress] = useState(userProfile?.address || localStorage.getItem('user_address') || 'Mumbai');

  // Search State
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [locationInput, setLocationInput] = useState('');
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [isSuggestionsDropdownOpen, setIsSuggestionsDropdownOpen] = useState(false);
  const [suggestions, setSuggestions] = useState({ categories: [], workers: [], locations: [] });

  // Filters State
  const [sortBy, setSortBy] = useState('nearest');
  const [cityFilter, setCityFilter] = useState('all');
  const [distanceFilter, setDistanceFilter] = useState('all');
  const [expFilter, setExpFilter] = useState('all');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(true);
  const [allWorkers, setAllWorkers] = useState([]);
  const [filteredWorkers, setFilteredWorkers] = useState([]);

  const catName = categoryId ? SERVICE_CATEGORIES.find(c => c.id === categoryId)?.name || 'All' : 'All';

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const geocodeAddressNominatim = async (addressText) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressText)}&format=json&limit=1`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'ServiConnect-App' }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          address: data[0].display_name.split(',')[0] + ', ' + (data[0].display_name.split(',')[1] || '').trim()
        };
      }
    } catch (err) { console.error('Geocoding failed:', err); }
    return null;
  };

  const reverseGeocodeNominatim = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'ServiConnect-App' }
      });
      const data = await res.json();
      if (data && data.display_name) {
        const addr = data.address;
        const parts = [];
        if (addr) {
          if (addr.suburb) parts.push(addr.suburb);
          else if (addr.neighbourhood) parts.push(addr.neighbourhood);
          else if (addr.locality) parts.push(addr.locality);
          if (addr.city) parts.push(addr.city);
          else if (addr.town) parts.push(addr.town);
          else if (addr.state) parts.push(addr.state);
        }
        return parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 2).join(', ');
      }
    } catch (err) { console.error('Reverse geocoding failed:', err); }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  const handleGPSDetect = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const addr = await reverseGeocodeNominatim(latitude, longitude);
        handleSaveLocation({ lat: latitude, lng: longitude, address: addr });
        setLoading(false);
      },
      (err) => {
        console.warn('GPS location retrieval failed:', err);
        toast.error('Could not access GPS location.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleSaveLocation = async (loc) => {
    setUserLat(loc.lat);
    setUserLng(loc.lng);
    setUserAddress(loc.address);

    if (user) {
      try {
        await updateUserProfile({ address: loc.address, lat: loc.lat, lng: loc.lng });
        toast.success('Location updated');
      } catch (err) { console.warn('Profile update failed:', err.message); }
    } else {
      localStorage.setItem('user_address', loc.address);
      localStorage.setItem('user_lat', loc.lat.toString());
      localStorage.setItem('user_lng', loc.lng.toString());
      toast.success('Saved local address');
    }
  };

  useEffect(() => {
    const hasLocation = userProfile?.address || localStorage.getItem('user_address');
    if (!hasLocation) handleGPSDetect();
  }, [userProfile?.address]);

  useEffect(() => {
    const loadWorkers = async () => {
      setLoading(true);
      try {
        if (!db) return;
        const querySnapshot = await getDocs(collection(db, 'workers'));
        const list = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const wLat = data.lat || 19.076;
          const wLng = data.lng || 72.877;
          const dist = parseFloat(getDistance(userLat, userLng, wLat, wLng));
          return { id: doc.id, ...data, distance: dist, rating: data.rating || 5.0, jobs: data.jobs || 0 };
        });
        setAllWorkers(list);
      } catch (err) {
        console.error('Error fetching workers:', err);
        toast.error('Could not load workers');
      } finally { setLoading(false); }
    };
    loadWorkers();
  }, [userLat, userLng]);

  const getExperienceNumber = (expStr) => {
    if (!expStr) return 0;
    if (expStr.includes('10+')) return 10;
    if (expStr.includes('5-10')) return 7;
    if (expStr.includes('3-5')) return 4;
    if (expStr.includes('1-2')) return 1.5;
    return 0.5;
  };

  const getSearchScore = (worker, queryText) => {
    if (!queryText) return 1;
    const cleanQuery = queryText.toLowerCase().trim();
    const words = cleanQuery.split(/\s+/).filter(Boolean);
    if (words.length === 0) return 1;
    let matchCount = 0;
    const cat = SERVICE_CATEGORIES.find(c => c.id === worker.category);
    const catName = cat?.name || '';
    const searchString = `${worker.name} ${worker.category} ${catName} ${worker.city} ${worker.address} ${worker.bio || ''}`.toLowerCase();
    for (const word of words) if (searchString.includes(word)) matchCount++;
    let boost = 0;
    if (worker.name.toLowerCase().includes(cleanQuery)) boost += 10;
    if (worker.category.toLowerCase().includes(cleanQuery) || catName.toLowerCase().includes(cleanQuery)) boost += 8;
    if (worker.city?.toLowerCase().includes(cleanQuery)) boost += 5;
    if (worker.address?.toLowerCase().includes(cleanQuery)) boost += 3;
    return matchCount > 0 ? (matchCount * 5 + boost) : 0;
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions({ categories: [], workers: [], locations: [] });
      return;
    }
    const cleanQuery = searchQuery.toLowerCase().trim();
    const matchedCategories = SERVICE_CATEGORIES.filter(cat => cat.name.toLowerCase().includes(cleanQuery)).slice(0, 3);
    const matchedWorkers = allWorkers.filter(w => w.name.toLowerCase().includes(cleanQuery)).slice(0, 4);
    const localities = new Set();
    const cities = new Set();
    allWorkers.forEach(w => {
      if (w.city) cities.add(w.city);
      if (w.address) {
        const parts = w.address.split(',').map(p => p.trim());
        parts.forEach(part => { if (part.toLowerCase().includes(cleanQuery) && part.length > 2 && part.length < 30) localities.add(part); });
      }
    });
    const matchedLocations = [
      ...Array.from(cities).filter(c => c.toLowerCase().includes(cleanQuery)).map(c => ({ name: c, type: 'city' })),
      ...Array.from(localities).filter(l => l.toLowerCase().includes(cleanQuery)).map(l => ({ name: l, type: 'locality' }))
    ].slice(0, 4);
    setSuggestions({ categories: matchedCategories, workers: matchedWorkers, locations: matchedLocations });
  }, [searchQuery, allWorkers]);

  useEffect(() => {
    let result = [...allWorkers];
    if (categoryId) result = result.filter(w => w.category === categoryId);
    result = result.filter(w => !w.disabled && w.available !== false);
    if (searchQuery.trim()) result = result.filter(w => getSearchScore(w, searchQuery) > 0);
    if (cityFilter !== 'all') result = result.filter(w => w.city?.toLowerCase() === cityFilter.toLowerCase());
    if (distanceFilter !== 'all') {
      const maxDistance = parseFloat(distanceFilter);
      result = result.filter(w => w.distance <= maxDistance);
    }
    if (expFilter !== 'all') result = result.filter(w => w.experience === expFilter);

    if (sortBy === 'nearest') {
      result.sort((a, b) => {
        const distA = Math.round(a.distance);
        const distB = Math.round(b.distance);
        if (distA !== distB) return distA - distB;
        if (b.rating !== a.rating) return b.rating - a.rating;
        const badgeOrder = { 'AI Verified': 3, 'Trusted': 2, 'New': 1, 'Standard': 0 };
        const badgeA = badgeOrder[a.badge] || 0;
        const badgeB = badgeOrder[b.badge] || 0;
        if (badgeB !== badgeA) return badgeB - badgeA;
        return getExperienceNumber(b.experience) - getExperienceNumber(a.experience);
      });
    } else if (sortBy === 'top') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'price') {
      result.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'experience') {
      result.sort((a, b) => getExperienceNumber(b.experience) - getExperienceNumber(a.experience));
    } else if (sortBy === 'badge') {
      const badgeOrder = { 'AI Verified': 3, 'Trusted': 2, 'New': 1, 'Standard': 0 };
      result.sort((a, b) => (badgeOrder[b.badge] || 0) - (badgeOrder[a.badge] || 0));
    }
    setFilteredWorkers(result);
  }, [allWorkers, categoryId, searchQuery, sortBy, cityFilter, distanceFilter, expFilter]);

  const avgPrice = filteredWorkers.length ? Math.round(filteredWorkers.reduce((sum, w) => sum + (w.price || 0), 0) / filteredWorkers.length) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      <div className="sticky top-16 z-40 bg-white dark:bg-gray-905 border-b border-gray-100 dark:border-gray-800 shadow-sm px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-3 items-center">
          <div className="flex items-center gap-3 w-full md:w-auto self-start md:self-auto">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors shrink-0">
              <ArrowLeft size={20} />
            </button>
            <div className="shrink-0">
              <h1 className="font-extrabold text-gray-900 dark:text-white text-lg tracking-tight">{catName}</h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">Instant Matcher</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch md:flex-1 w-full border border-gray-200 dark:border-gray-700 rounded-xl overflow-visible shadow-soft bg-gray-50 dark:bg-gray-800 relative z-50">
            <div className="relative flex-1 min-w-[200px] border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700 flex items-center px-3 py-2.5">
              <MapPin size={18} className="text-primary-light shrink-0 mr-2" />
              <button
                type="button"
                onClick={() => { setIsLocationDropdownOpen(!isLocationDropdownOpen); setIsSuggestionsDropdownOpen(false); }}
                className="w-full text-left text-xs md:text-sm font-semibold text-gray-750 dark:text-gray-300 truncate focus:outline-none flex items-center justify-between"
              >
                <span>{userAddress || 'Select Location'}</span>
                <ChevronDown size={14} className="text-gray-450 ml-1 shrink-0" />
              </button>
              <AnimatePresence>
                {isLocationDropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-750 rounded-xl shadow-xl z-[1000] overflow-hidden text-sm">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex gap-2">
                      <input type="text" placeholder="Search city/locality..." value={locationInput} onChange={e => setLocationInput(e.target.value)} className="flex-1 text-xs px-3 py-1.5 border border-gray-250 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg outline-none" />
                      <button onClick={async () => { if (locationInput.trim()) { const resolved = await geocodeAddressNominatim(locationInput); if (resolved) { handleSaveLocation(resolved); setIsLocationDropdownOpen(false); } else { toast.error(`Could not resolve "${locationInput}"`); } } }} className="px-3 py-1.5 bg-primary-light text-white text-xs font-bold rounded-lg">Search</button>
                    </div>
                    <div className="py-1">
                      <button onClick={() => { handleGPSDetect(); setIsLocationDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-bold text-primary-light flex items-center gap-2"><Navigation size={14} /> Use Current GPS Location</button>
                      <button onClick={() => { setIsMapOpen(true); setIsLocationDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-bold text-gray-700 flex items-center gap-2"><Map size={14} /> Select Location on Map</button>
                      <div className="border-t border-gray-100 my-1"></div>
                      <div className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Popular Cities</div>
                      {POPULAR_CITIES.map(city => (
                        <button key={city.name} onClick={() => { handleSaveLocation({ lat: city.lat, lng: city.lng, address: city.name }); setIsLocationDropdownOpen(false); }} className="w-full text-left px-6 py-2 hover:bg-gray-50 text-xs text-gray-600 font-medium">🏙️ {city.name}</button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="relative flex-[1.5] min-w-[240px] flex items-center px-3 py-2.5">
              <Search size={18} className="text-gray-400 shrink-0 mr-2" />
              <input type="text" placeholder="Search name, category, city..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setIsSuggestionsDropdownOpen(true); setIsLocationDropdownOpen(false); }} onFocus={() => { setIsSuggestionsDropdownOpen(true); setIsLocationDropdownOpen(false); }} className="bg-transparent flex-1 text-xs md:text-sm text-gray-800 dark:text-white outline-none placeholder-gray-400 font-semibold" />
              {searchQuery && <button onClick={() => { setSearchQuery(''); setSuggestions({ categories: [], workers: [], locations: [] }); }} className="p-1 rounded-full text-gray-400"><X size={14} /></button>}
              <AnimatePresence>
                {isSuggestionsDropdownOpen && searchQuery.trim() && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-755 rounded-xl shadow-xl z-[1000] max-h-80 overflow-y-auto">
                    {suggestions.categories.length === 0 && suggestions.workers.length === 0 && suggestions.locations.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400">No matches found for "{searchQuery}"</div>
                    ) : (
                      <div className="py-2">
                        {suggestions.categories.length > 0 && (
                          <div>
                            <div className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase">Categories</div>
                            {suggestions.categories.map(cat => (
                              <button key={cat.id} onClick={() => { setSearchQuery(cat.name); setIsSuggestionsDropdownOpen(false); setSearchParams({ category: cat.id }); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs font-semibold text-gray-800 flex items-center gap-2"><span>{cat.icon}</span><span>{cat.name}</span></button>
                            ))}
                          </div>
                        )}
                        {suggestions.locations.length > 0 && (
                          <div className="mt-2">
                            <div className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase">Locations</div>
                            {suggestions.locations.map((loc, i) => (
                              <button key={i} onClick={async () => { setSearchQuery(loc.name); setIsSuggestionsDropdownOpen(false); const resolved = await geocodeAddressNominatim(loc.name); if (resolved) handleSaveLocation(resolved); else { const pop = CITY_COORDINATES[loc.name.toLowerCase()]; if (pop) handleSaveLocation({ lat: pop.lat, lng: pop.lng, address: loc.name }); } }} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs text-gray-700 flex items-center gap-2 font-medium"><span>{loc.type === 'city' ? '🌆' : '📍'}</span><span>{loc.name}</span></button>
                            ))}
                          </div>
                        )}
                        {suggestions.workers.length > 0 && (
                          <div className="mt-2">
                            <div className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase">Workers</div>
                            {suggestions.workers.map(w => (
                              <button key={w.id} onClick={() => { setIsSuggestionsDropdownOpen(false); navigate(`/worker/${w.id}`); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs text-gray-755 flex items-center justify-between"><div className="flex items-center gap-2"><span>👤</span><span className="font-bold">{w.name}</span><span className="text-[10px] text-gray-400 capitalize">({w.category})</span></div></button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 w-full md:w-auto justify-end">
            <button onClick={() => setShowFiltersPanel(!showFiltersPanel)} className={`p-2.5 rounded-lg border text-sm font-medium transition-colors ${showFiltersPanel || cityFilter !== 'all' || distanceFilter !== 'all' || expFilter !== 'all' ? 'bg-primary-light/10 text-primary-light border-primary-light/30' : 'bg-white dark:bg-gray-900 text-gray-650 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}><SlidersHorizontal size={18} /></button>
            <button onClick={() => setView(v => v === 'list' ? 'map' : 'list')} className="flex items-center gap-1.5 px-3 py-2 bg-primary-light/10 text-primary-light rounded-button text-xs md:text-sm font-semibold border border-primary-light/20 shadow-sm">{view === 'list' ? <><Map size={16} /> Map</> : <><List size={16} /> List</>}</button>
          </div>
        </div>
        {(isLocationDropdownOpen || isSuggestionsDropdownOpen) && <div className="fixed inset-0 z-40 bg-transparent" onClick={() => { setIsLocationDropdownOpen(false); setIsSuggestionsDropdownOpen(false); }} />}
      </div>
      <LocationPickerModal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} onSave={handleSaveLocation} initialLat={userLat} initialLng={userLng} initialAddress={userAddress === 'Select Location' ? '' : userAddress} />
      <div className="flex gap-2 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 overflow-x-auto scrollbar-hide">
        {[
          { id: 'nearest', label: '📍 Nearest' },
          { id: 'top', label: '⭐ Top Rated' },
          { id: 'price', label: '💰 Price Low' },
          { id: 'badge', label: '🤖 AI Verified' },
          { id: 'experience', label: '💼 Experience' }
        ].map(f => (
          <button key={f.id} onClick={() => setSortBy(f.id)} className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${sortBy === f.id ? 'bg-primary-light text-white' : 'bg-white text-gray-655 border border-gray-200'}`}>{f.label}</button>
        ))}
      </div>
      <AnimatePresence>
        {showFiltersPanel && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b border-gray-100 bg-gray-50 overflow-hidden">
            <div className="p-4 grid grid-cols-3 gap-3">
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-550 uppercase">City</label><select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="w-full text-xs p-2 border rounded-lg outline-none"><option value="all">All Cities</option>{INDIAN_CITIES.map(city => <option key={city} value={city}>{city}</option>)}</select></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-550 uppercase">Distance Range</label><select value={distanceFilter} onChange={(e) => setDistanceFilter(e.target.value)} className="w-full text-xs p-2 border rounded-lg outline-none"><option value="all">Any Distance</option><option value="5">Within 5 km</option><option value="10">Within 10 km</option><option value="25">Within 25 km</option><option value="50">Within 50 km</option></select></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-550 uppercase">Experience</label><select value={expFilter} onChange={(e) => setExpFilter(e.target.value)} className="w-full text-xs p-2 border rounded-lg outline-none"><option value="all">Any Experience</option><option value="Less than 1">Less than 1 year</option><option value="1-2">1-2 years</option><option value="3-5">3-5 years</option><option value="5-10">5-10 years</option><option value="10+">10+ years</option></select></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!loading && filteredWorkers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 my-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-card border border-green-150">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-semibold text-green-700 uppercase">Average Visit Price</p><p className="text-2xl font-black text-green-800">₹{avgPrice}<span className="text-sm font-normal">/visit</span></p></div>
            <div className="text-right text-xs text-green-600"><p>Based on {filteredWorkers.length} {catName}s</p><p>near your location</p></div>
          </div>
        </motion.div>
      )}
      {view === 'map' && !loading && (
        <div className="mx-4 mb-4 h-[400px] rounded-card overflow-hidden border border-gray-200 shadow-md relative z-0">
          <MapContainer center={[userLat, userLng]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='© OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ChangeMapCenter center={[userLat, userLng]} />
            <Marker position={[userLat, userLng]}><Popup>Your Location</Popup></Marker>
            {filteredWorkers.map(w => (
              <Marker key={w.id} position={[w.lat || 19.076, w.lng || 72.877]}><Popup><div className="p-1"><p className="font-bold text-sm text-gray-900">{w.name}</p><p className="text-xs text-gray-550 capitalize">{w.category}</p><p className="text-xs text-gray-700 font-bold mt-1">₹{w.price} • {w.distance}km away</p><button onClick={() => navigate(`/worker/${w.id}`)} className="mt-2 text-xs w-full py-1 text-center bg-primary-light text-white rounded font-bold">View Profile</button></div></Popup></Marker>
            ))}
          </MapContainer>
        </div>
      )}
      <div className="px-4 pb-6">
        {loading ? (
          <div className="flex flex-col gap-4">{[1, 2, 3].map(i => <div key={i} className="bg-white rounded-card p-4 border animate-pulse h-24" />)}</div>
        ) : filteredWorkers.length === 0 ? (
          <EmptyState title="No workers match your search" description="Try clearing your filters or picking a different location." illustration="🔍" action={<button onClick={() => { setSearchQuery(''); setCityFilter('all'); setDistanceFilter('all'); setExpFilter('all'); }} className="px-6 py-2.5 bg-primary-light text-white rounded-button font-bold text-xs">Clear Search & Filters</button>} />
        ) : (
          <StaggerContainer className="flex flex-col gap-4">
            {filteredWorkers.map(worker => (
              <StaggerItem key={worker.id}>
                <motion.div whileHover={{ y: -2 }} onClick={() => navigate(`/worker/${worker.id}`)} className="bg-white rounded-card p-4 border cursor-pointer shadow-soft hover:shadow-md transition-shadow">
                  <div className="flex gap-4">
                    <div className="relative flex-shrink-0">{worker.avatar ? <img src={formatImageUrl(worker.avatar)} alt={worker.name} className="w-16 h-16 rounded-full object-cover border" /> : <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-light to-blue-400 flex items-center justify-center text-white font-bold">{worker.name.charAt(0)}</div>}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between"><div><h3 className="font-bold text-gray-900">{worker.name}</h3><p className="text-xs text-gray-500 capitalize">{worker.category} • {worker.experience} yrs exp</p></div><span className="font-black text-primary-light text-sm">₹{worker.price}</span></div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap"><div className="flex items-center gap-1 text-xs text-amber-500 font-bold"><Star size={12} fill="currentColor" /><span>{worker.rating.toFixed(1)}</span></div><span className="text-xs text-gray-500 flex items-center"><MapPin size={12} className="mr-0.5" />{worker.distance} km</span>{worker.verificationStatus === 'verified' && <Badge variant="success" className="flex items-center gap-0.5"><ShieldCheck size={10} /> Verified</Badge>}{worker.badge && <Badge variant="primary">{worker.badge}</Badge>}</div>
                    </div>
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
