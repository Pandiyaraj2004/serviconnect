import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, Search, Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import LocationPickerModal from './LocationPickerModal';
import toast from 'react-hot-toast';
import { subscribeToNotifications } from '../utils/notifications';

const DashboardHeader = ({ userName, searchQuery, setSearchQuery }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile, updateUserProfile } = useAuth();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }
    const unsub = subscribeToNotifications(user.uid, (items) => {
      setUnreadCount(items.filter(i => !i.read).length);
    });
    return () => unsub();
  }, [user?.uid]);

  const displayAddress = userProfile?.address || localStorage.getItem('user_address') || 'Select Location';
  const lat = userProfile?.lat || parseFloat(localStorage.getItem('user_lat')) || 19.076;
  const lng = userProfile?.lng || parseFloat(localStorage.getItem('user_lng')) || 72.877;

  const handleSaveLocation = async (loc) => {
    try {
      if (user) {
        await updateUserProfile({
          address: loc.address,
          lat: loc.lat,
          lng: loc.lng,
        });
        toast.success('Location saved successfully');
      } else {
        localStorage.setItem('user_address', loc.address);
        localStorage.setItem('user_lat', loc.lat.toString());
        localStorage.setItem('user_lng', loc.lng.toString());
        toast.success('Location set locally');
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (err) {
      toast.error('Could not save location');
    }
  };

  return (
    <div className="sticky top-16 z-40 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center gap-3 md:gap-4">
          {/* Location Selector - Urban Company Style */}
          <motion.button 
            whileHover={{ backgroundColor: 'var(--hover-bg)' }}
            onClick={() => setIsMapOpen(true)}
            className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 shrink-0 group max-w-[150px] sm:max-w-[200px]"
          >
            <MapPin size={16} className="text-primary-light dark:text-primary-dark group-hover:scale-110 transition-transform duration-200" />
            <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
              {displayAddress}
            </span>
          </motion.button>

          <LocationPickerModal
            isOpen={isMapOpen}
            onClose={() => setIsMapOpen(false)}
            onSave={handleSaveLocation}
            initialLat={lat}
            initialLng={lng}
            initialAddress={displayAddress === 'Select Location' ? '' : displayAddress}
          />

          {/* Search Bar - LinkedIn Style */}
          <motion.div 
            className={`flex-1 min-w-0 transition-all duration-300 ${
              isSearchFocused ? 'ring-2 ring-primary-light dark:ring-primary-dark' : ''
            }`}
            animate={{ scale: isSearchFocused ? 1.02 : 1 }}
          >
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2.5 hover:bg-gray-150 dark:hover:bg-gray-750 transition-colors duration-200">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search services, workers, locations..."
                value={searchQuery}
                onChange={e => {
                  if (location.pathname !== '/search') {
                    navigate(`/search?q=${encodeURIComponent(e.target.value)}`);
                  } else {
                    setSearchQuery(e.target.value);
                  }
                }}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className="bg-transparent flex-1 min-w-0 text-xs md:text-sm text-gray-700 dark:text-gray-300 outline-none placeholder-gray-400 dark:placeholder-gray-500 font-medium"
              />
            </div>
          </motion.div>

          {/* Right Actions - Compact on Mobile */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* Notification Badge */}
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/notifications')}
              className="relative p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
              aria-label="Notifications"
            >
              <Bell size={18} className="text-gray-600 dark:text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </motion.button>

            {/* Profile Avatar - Always Visible */}
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/settings')}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-primary-light to-blue-400 flex items-center justify-center text-white text-xs md:text-sm font-bold hover:shadow-lg transition-shadow duration-200 shrink-0"
              title={userName || 'Profile'}
            >
              {(userName || 'U').charAt(0).toUpperCase()}
            </motion.button>
          </div>
        </div>

        {/* Search Results Summary - Shows when searching */}
        {searchQuery && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-xs text-gray-500 dark:text-gray-400"
          >
            Searching for: <span className="font-semibold text-gray-700 dark:text-gray-300">"{searchQuery}"</span>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DashboardHeader;
