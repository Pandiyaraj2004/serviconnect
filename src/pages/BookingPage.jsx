import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Clock, Info, CheckCircle, Loader2, Search } from 'lucide-react';
import { sendWorkerBookingNotification, formatImageUrl } from '../utils/helpers';
import { createNotification, NOTIF_TEMPLATES } from '../utils/notifications';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import toast from 'react-hot-toast';
import LocationPickerModal from '../components/LocationPickerModal';

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});


// Helper component to center Leaflet map
function ChangeMapCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

const BookingPage = () => {
  const navigate = useNavigate();
  const { id: workerId } = useParams();
  const { user, userProfile } = useAuth();
  const [step, setStep] = useState('form'); // form | success
  const [loading, setLoading] = useState(false);
  const [workerLoading, setWorkerLoading] = useState(true);
  const [worker, setWorker] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [problem, setProblem] = useState('');
  const [address, setAddress] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [bookingId, setBookingId] = useState('');

  // Initialize address and coordinates from userProfile once it loads
  useEffect(() => {
    if (userProfile?.address && !address) {
      setAddress(userProfile.address);
    }
    if (userProfile?.lat && userProfile?.lng && !selectedLocation) {
      setSelectedLocation({
        lat: userProfile.lat,
        lng: userProfile.lng
      });
    }
  }, [userProfile]);

  // Fetch real worker data
  useEffect(() => {
    const fetchWorker = async () => {
      setWorkerLoading(true);
      if (db && workerId) {
        try {
          const workerSnap = await getDoc(doc(db, 'workers', workerId));
          if (workerSnap.exists()) {
            setWorker({ id: workerSnap.id, ...workerSnap.data() });
          }
        } catch (err) {
          console.warn('Could not load worker data');
        }
      }
      setWorkerLoading(false);
    };
    fetchWorker();
  }, [workerId]);

  const { today, maxDate } = useMemo(() => {
    const now = new Date();
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 30);
    return {
      today: now.toISOString().split('T')[0],
      maxDate: limit.toISOString().split('T')[0],
    };
  }, []);

  const timeSlots = [
    { id: 'morning', label: '☀️ Morning', time: '8AM - 12PM' },
    { id: 'afternoon', label: '🌤 Afternoon', time: '12PM - 4PM' },
    { id: 'evening', label: '🌙 Evening', time: '4PM - 8PM' },
  ];

  const handleConfirm = async () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/book/${workerId}` } } });
      return;
    }

    if (!selectedDate) return toast.error('Please select a date');
    if (!selectedTime) return toast.error('Please select a time slot');
    if (!problem.trim()) return toast.error('Please describe the problem');
    if (!address.trim()) return toast.error('Please enter a service address');
    if (!worker) return toast.error('Worker data not loaded yet');

    if (!db) {
      toast.error('Database not configured. Please set up Firebase in .env file.');
      return;
    }

    setLoading(true);
    try {
      const wId = workerId || worker.id;

      // Check latest worker availability in database to prevent double bookings
      const workerRef = doc(db, 'workers', wId);
      const workerSnap = await getDoc(workerRef);
      if (workerSnap.exists() && !workerSnap.data().available) {
        toast.error('This worker is currently busy on an active job and cannot accept new bookings.');
        setLoading(false);
        return;
      }

      const booking = {
        customerId: user.uid,
        customerName: userProfile?.name || user.displayName || 'Customer',
        customerPhone: userProfile?.phone || user.phoneNumber || '',
        customerEmail: user.email || '',
        workerId: wId,
        workerName: worker.name,
        workerPhone: worker.phone || '',
        category: worker.category || '',
        price: worker.price || 0,
        date: selectedDate,
        timeSlot: selectedTime,
        problemDescription: problem.trim(),
        address: address.trim(),
        latitude: selectedLocation?.lat || null,
        longitude: selectedLocation?.lng || null,
        status: 'pending',
        paymentMode: 'cash',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const bookingRef = await addDoc(collection(db, 'bookings'), booking);
      const newBookingId = bookingRef.id;
      setBookingId(newBookingId);

      // 1. Send in-app notification to worker immediately
      await createNotification(
        wId,
        NOTIF_TEMPLATES.newBooking(booking.customerName, booking.category, newBookingId)
      );

      // 2. Open WhatsApp for worker notification (Opt-in only)
      if (userProfile?.whatsappOptIn && booking.workerPhone) {
        sendWorkerBookingNotification(booking.workerPhone, {
          customerName: booking.customerName,
          category: booking.category,
          problemDescription: problem,
          customerAddress: address,
          bookingDate: selectedDate,
          bookingTime: selectedTime,
          customerPhone: booking.customerPhone,
        });
      }

      toast.success('Booking sent! Worker notified.');
      setStep('success');
    } catch (err) {
      console.error('Booking error:', err);
      toast.error(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (workerLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-primary-light" />
          <p className="text-sm text-gray-500">Loading worker details...</p>
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-gray-500">Worker not found.</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-primary-light font-semibold">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-10">
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900 px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-gray-900 dark:text-white">Confirm Booking</h1>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 'form' ? (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-6 space-y-4 max-w-xl mx-auto">
            {/* Worker Summary */}
            <div className="bg-white dark:bg-surface-dark rounded-card p-4 border border-gray-100 dark:border-gray-800 flex items-center gap-4">
              {worker.avatar ? (
                <img src={formatImageUrl(worker.avatar)} alt={worker.name} className="w-16 h-16 rounded-full object-cover border shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-light to-blue-400 flex items-center justify-center text-white font-black text-xl shrink-0">
                  {worker.name.charAt(0)}
                </div>
              )}
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{worker.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{worker.category}</p>
                <p className="text-primary-light dark:text-primary-dark font-bold">₹{worker.price}/visit</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-green-500 font-semibold">🤖 AI Verified</div>
                <div className="text-xs text-gray-400 mt-1">Cash payment</div>
              </div>
            </div>

            {/* Date Selection */}
            <div className="bg-white dark:bg-surface-dark rounded-card p-4 border border-gray-100 dark:border-gray-800">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                <Calendar size={16} className="text-primary-light dark:text-primary-dark" /> Select Date *
              </label>
              <input
                type="date"
                min={today}
                max={maxDate}
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-input text-sm text-gray-900 dark:text-white outline-none focus:border-primary-light dark:focus:border-primary-dark"
              />
            </div>

            {/* Time Selection */}
            <div className="bg-white dark:bg-surface-dark rounded-card p-4 border border-gray-100 dark:border-gray-800">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                <Clock size={16} className="text-primary-light dark:text-primary-dark" /> Select Time *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {timeSlots.map(slot => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedTime(slot.id)}
                    className={`p-3 rounded-button text-center transition-all ${
                      selectedTime === slot.id
                        ? 'bg-primary-light dark:bg-primary-dark text-white'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="text-lg">{slot.label.split(' ')[0]}</div>
                    <div className="text-xs font-semibold mt-1">{slot.label.split(' ').slice(1).join(' ')}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{slot.time}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Problem Description */}
            <div className="bg-white dark:bg-surface-dark rounded-card p-4 border border-gray-100 dark:border-gray-800">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 block">Describe the Problem *</label>
              <textarea
                rows={4}
                placeholder="E.g., Water pipe is leaking under the sink, bathroom floor is wet..."
                value={problem}
                onChange={e => setProblem(e.target.value)}
                maxLength={500}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-input text-sm text-gray-900 dark:text-white outline-none focus:border-primary-light dark:focus:border-primary-dark resize-none"
              />
              <div className="text-right text-xs text-gray-400 mt-1">{problem.length}/500</div>
            </div>

            {/* Address with Map */}
            <div className="bg-white dark:bg-surface-dark rounded-card p-4 border border-gray-100 dark:border-gray-800">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                <MapPin size={16} className="text-primary-light dark:text-primary-dark" /> Service Address *
              </label>
              <div className="flex gap-2 mb-3">
                <textarea
                  rows={2}
                  placeholder="Enter your full address..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-input text-sm text-gray-900 dark:text-white outline-none focus:border-primary-light dark:focus:border-primary-dark resize-none"
                />
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="px-4 bg-primary-light/10 text-primary-light border border-primary-light/20 rounded-xl hover:bg-primary-light/20 transition-colors flex flex-col items-center justify-center gap-1 shrink-0 text-xs font-semibold"
                >
                  <Search size={16} />
                  <span>Search/Map</span>
                </button>
              </div>
              <div className="h-36 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800">
                <MapContainer center={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : [19.076, 72.877]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={false}>
                  <TileLayer attribution='© OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : [19.076, 72.877]} />
                  <ChangeMapCenter center={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : [19.076, 72.877]} />
                </MapContainer>
              </div>

              <LocationPickerModal
                isOpen={isLocationModalOpen}
                onClose={() => setIsLocationModalOpen(false)}
                onSave={(loc) => {
                  setAddress(loc.address);
                  setSelectedLocation({ lat: loc.lat, lng: loc.lng });
                }}
                initialLat={selectedLocation?.lat}
                initialLng={selectedLocation?.lng}
                initialAddress={address}
              />
            </div>

            {/* Info banners */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-card p-4 flex gap-3">
              <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Free booking & Cash payment.</strong> Pay only after the job is done to your satisfaction.
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-card p-4 flex gap-3">
              <span className="flex-shrink-0">💬</span>
              <div className="text-sm text-green-700 dark:text-green-300">
                Worker will receive a WhatsApp message automatically when you confirm.
              </div>
            </div>

            {/* Confirm Button */}
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleConfirm}
              disabled={loading}
              className="w-full py-4 bg-primary-light dark:bg-primary-dark text-white rounded-button text-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-70"
            >
              {loading ? <><Loader2 size={20} className="animate-spin" /> Confirming...</> : 'Confirm Booking'}
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[80vh] px-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="w-28 h-28 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-8"
            >
              <CheckCircle className="text-green-500 w-16 h-16" />
            </motion.div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">Booked! 🎉</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-2">Your booking ID is</p>
            <p className="text-2xl font-mono font-bold text-primary-light dark:text-primary-dark mb-6">#{bookingId}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
              {worker.name} has been notified via WhatsApp and will confirm shortly.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={() => navigate('/bookings')} className="py-3 bg-primary-light dark:bg-primary-dark text-white rounded-button font-semibold">
                View My Bookings
              </button>
              <button onClick={() => navigate('/dashboard')} className="py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-button font-semibold">
                Back to Home
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookingPage;
