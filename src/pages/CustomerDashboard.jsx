import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SERVICE_CATEGORIES, getGreeting, getDistance, formatImageUrl } from '../utils/helpers';
import toast from 'react-hot-toast';
import { BottomNav, Skeleton } from '../components/UI';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardHeader from '../components/DashboardHeader';
import { subscribeToNotifications } from '../utils/notifications';

const PROMO_BANNERS = [
  { title: 'First Booking Free', subtitle: 'Get ₹100 off on your first booking', color: 'from-blue-500 to-indigo-600', icon: '🎁' },
  { title: 'AI Verified Experts', subtitle: 'Every worker is skill-tested by Gemini AI', color: 'from-purple-500 to-pink-600', icon: '🤖' },
  { title: '24/7 Emergency', subtitle: 'Book anytime, day or night', color: 'from-orange-500 to-red-500', icon: '⚡' },
];

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { user, userProfile, updateUserProfile } = useAuth();
  const [bannerIndex, setBannerIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const displayAddress = userProfile?.address || localStorage.getItem('user_address') || 'Select Location';
  const userLat = userProfile?.lat || parseFloat(localStorage.getItem('user_lat')) || 19.076;
  const userLng = userProfile?.lng || parseFloat(localStorage.getItem('user_lng')) || 72.877;

  useEffect(() => {
    const timer = setInterval(() => setBannerIndex(prev => (prev + 1) % PROMO_BANNERS.length), 4000);
    return () => clearInterval(timer);
  }, []);

  // Redirect if worker or admin
  useEffect(() => {
    if (userProfile !== null && userProfile !== undefined) {
      if (userProfile.role === 'worker') {
        navigate('/worker-dashboard');
      } else if (userProfile.role === 'admin') {
        navigate('/admin');
      }
    }
  }, [userProfile, navigate]);

  // Subscribe to real-time unread notification count
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToNotifications(user.uid, (items) => {
      setUnreadCount(items.filter(i => !i.read).length);
    });
    return () => unsub();
  }, [user?.uid]);

  // Auto ask location permission if no location saved
  useEffect(() => {
    const savedAddress = userProfile?.address || localStorage.getItem('user_address');
    if (!savedAddress && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, {
              headers: { 'Accept-Language': 'en', 'User-Agent': 'ServiConnect-App' }
            });
            const data = await res.json();
            let addr = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            if (data && data.display_name) {
              const a = data.address;
              const parts = [];
              if (a) {
                if (a.suburb) parts.push(a.suburb);
                else if (a.neighbourhood) parts.push(a.neighbourhood);
                else if (a.locality) parts.push(a.locality);
                if (a.city) parts.push(a.city);
              }
              addr = parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 2).join(', ');
            }
            if (user) {
              await updateUserProfile({
                address: addr,
                lat: latitude,
                lng: longitude
              });
            } else {
              localStorage.setItem('user_address', addr);
              localStorage.setItem('user_lat', latitude.toString());
              localStorage.setItem('user_lng', longitude.toString());
            }
            toast.success(`Location set to: ${addr}`);
            setTimeout(() => window.location.reload(), 1000);
          } catch (err) {
            console.warn('Auto GPS reverse geocode error:', err);
          }
        },
        (err) => {
          console.warn('Auto GPS permission denied or failed:', err);
        }
      );
    }
  }, [userProfile?.address, user]);

  // Fetch nearby available workers from Firestore
  useEffect(() => {
    const loadWorkers = async () => {
      setLoadingWorkers(true);
      try {
        if (!db) {
          setLoadingWorkers(false);
          return;
        }
        const querySnapshot = await getDocs(collection(db, 'workers'));
        let list = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const wLat = data.lat || 19.076;
          const wLng = data.lng || 72.877;
          return {
            id: doc.id,
            ...data,
            distance: parseFloat(getDistance(userLat, userLng, wLat, wLng)),
            rating: data.rating || 5.0,
            jobs: data.jobs || 0,
          };
        });

        // Only show active and available workers
        list = list.filter(w => !w.disabled && w.available !== false);
        
        // Sort by nearest
        list.sort((a, b) => a.distance - b.distance);
        setWorkers(list.slice(0, 3)); // show top 3 nearest on dashboard
      } catch (err) {
        console.error('Error fetching dashboard workers:', err);
      } finally {
        setLoadingWorkers(false);
      }
    };
    loadWorkers();
  }, [userLat, userLng]);

  const greeting = getGreeting();
  const name = user?.displayName || userProfile?.name || 'Customer';

  const filteredCategories = searchQuery
    ? SERVICE_CATEGORIES.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : SERVICE_CATEGORIES;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20 pt-16">
      <DashboardHeader 
        userName={name} 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
      />

      <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">{greeting} 👋</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{name.split(' ')[0]}</h2>
        </motion.div>

        {/* Promo Banner */}
        <div className="mb-6 overflow-hidden rounded-card">
          <div
            className="flex transition-transform duration-500"
            style={{ transform: `translateX(-${bannerIndex * 100}%)` }}
          >
            {PROMO_BANNERS.map((b, i) => (
              <div key={i} className={`min-w-full bg-gradient-to-r ${b.color} p-6 flex items-center gap-4`}>
                <span className="text-4xl">{b.icon}</span>
                <div>
                  <h3 className="font-bold text-white text-lg">{b.title}</h3>
                  <p className="text-white/80 text-sm">{b.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-1.5 mt-3">
            {PROMO_BANNERS.map((_, i) => (
              <button key={i} onClick={() => setBannerIndex(i)} className={`h-1.5 rounded-full transition-all ${i === bannerIndex ? 'w-6 bg-primary-light dark:bg-primary-dark' : 'w-1.5 bg-gray-300 dark:bg-gray-600'}`} />
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">What do you need?</h3>
            <button onClick={() => navigate('/search')} className="text-xs md:text-sm text-primary-light dark:text-primary-dark font-medium flex items-center gap-1 hover:gap-2 transition-all duration-200">
              See all <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 md:gap-3">
            {(searchQuery ? filteredCategories : SERVICE_CATEGORIES.slice(0, 8)).map((cat, i) => (
              <motion.button
                key={cat.id}
                whileHover={{ y: -4, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/search?category=${cat.id}`)}
                className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary-light dark:hover:border-primary-dark hover:shadow-md transition-all duration-200"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="text-xl md:text-2xl">{cat.icon}</span>
                <span className="text-[10px] md:text-xs font-medium text-gray-600 dark:text-gray-400 text-center leading-tight line-clamp-2">{cat.name}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Available Right Now */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Nearby Verified Workers</h3>
            <button onClick={() => navigate('/search')} className="text-xs md:text-sm text-primary-light dark:text-primary-dark font-medium flex items-center gap-1 hover:gap-2 transition-all duration-200">
              See all <ChevronRight size={16} />
            </button>
          </div>
          
          {loadingWorkers ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 animate-pulse">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                </div>
              ))}
            </div>
          ) : workers.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-100 dark:border-gray-700">
              <span className="text-3xl">🔍</span>
              <p className="text-sm text-gray-500 mt-2">No active workers found near your pinned location.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workers.map((worker, i) => (
                <motion.div
                  key={worker.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow duration-200"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="relative shrink-0">
                      {worker.avatar ? (
                        <img src={formatImageUrl(worker.avatar)} alt={worker.name} className="w-12 h-12 rounded-full object-cover border" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-light to-blue-400 flex items-center justify-center text-white font-bold text-sm">
                          {worker.name.charAt(0)}
                        </div>
                      )}
                      {worker.available && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm md:text-base text-gray-900 dark:text-white truncate">{worker.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{worker.category}</div>
                      <div className="text-xs text-amber-500 font-medium mt-0.5 flex items-center gap-1">
                        <Star size={12} fill="currentColor" />
                        <span>{worker.rating.toFixed(1)} ({worker.jobs} jobs)</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-4 text-xs text-gray-600 dark:text-gray-400">
                    <span>📍 {worker.distance} km away</span>
                    <span className="font-bold text-primary-light dark:text-primary-dark">₹{worker.price}</span>
                  </div>
                  <button
                    onClick={() => navigate(`/worker/${worker.id}`)}
                    className="w-full py-2 bg-primary-light dark:bg-primary-dark text-white rounded-lg text-xs md:text-sm font-semibold hover:opacity-90 active:scale-95 transition-all duration-200"
                  >
                    View & Book
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav active="home" onNavigate={navigate} unreadNotifications={unreadCount} />
    </div>
  );
};

export default CustomerDashboard;
