import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Star, MapPin, MessageCircle, X, ShieldAlert } from 'lucide-react';
import { Badge } from '../components/UI';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';

const TrustScoreRing = ({ score }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let s = 0; 
    const t = setInterval(() => { 
      s += 0.1; 
      if (s >= score) { 
        setDisplay(score); 
        clearInterval(t); 
      } else {
        setDisplay(parseFloat(s.toFixed(1))); 
      }
    }, 20);
    return () => clearInterval(t);
  }, [score]);

  const radius = 45; 
  const circ = 2 * Math.PI * radius;
  const pct = (display / 10) * circ;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-100 dark:text-gray-800" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke="url(#grad)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - pct} className="transition-all duration-1000" />
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0071E3" /> <stop offset="100%" stopColor="#30D158" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black text-gray-900 dark:text-white">{display}</span>
        <span className="text-[10px] text-gray-500">/ 10</span>
      </div>
    </div>
  );
};

const ScoreBar = ({ label, value, delay }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => { setTimeout(() => setWidth(value * 10), delay); }, [value, delay]);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-semibold text-gray-800 dark:text-gray-200">{value}/10</span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-primary-light dark:bg-primary-dark rounded-full transition-all duration-1000" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
};

const WorkerProfile = () => {
  const navigate = useNavigate();
  const { id: workerId } = useParams();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  useEffect(() => {
    const fetchWorkerData = async () => {
      if (!db || !workerId) return;
      try {
        const workerSnap = await getDoc(doc(db, 'workers', workerId));
        if (workerSnap.exists()) {
          const wData = workerSnap.data();
          
          // Check if disabled by admin
          if (wData.disabled) {
            setWorker({ ...wData, id: workerSnap.id, blocked: true });
            setLoading(false);
            return;
          }

          // Fetch reviews and jobs from completed bookings in Firestore
          const bookingsRef = collection(db, 'bookings');
          const q = query(bookingsRef, where('workerId', '==', workerId), where('status', '==', 'completed'));
          const bookingsSnap = await getDocs(q);
          const reviewsList = bookingsSnap.docs
            .map(d => d.data())
            .filter(b => b.review)
            .map(b => ({
              author: b.customerName || 'Customer',
              rating: b.rating || 5,
              text: b.review,
              date: b.reviewedAt ? new Date(b.reviewedAt.seconds ? b.reviewedAt.seconds * 1000 : b.reviewedAt).toLocaleDateString() : 'Recent',
              avatar: b.customerName ? b.customerName.charAt(0) : 'C',
            }));

          const completedBookings = bookingsSnap.docs.map(d => d.data());
          const totalJobs = completedBookings.length;
          const ratedJobs = completedBookings.filter(b => b.rating);
          const avgRating = ratedJobs.length 
            ? parseFloat((ratedJobs.reduce((sum, b) => sum + b.rating, 0) / ratedJobs.length).toFixed(1))
            : 5.0;

          // Convert trustScore to 0-10 scale
          const rawScore = wData.trustScore || 70;
          const overall = parseFloat((rawScore / 10).toFixed(1));
          const reliability = Math.min(10, parseFloat((overall + 0.4).toFixed(1)));
          const quality = overall;
          const punctuality = Math.min(10, parseFloat((overall - 0.4).toFixed(1)));

          setWorker({
            id: workerSnap.id,
            ...wData,
            rating: avgRating,
            jobs: totalJobs,
            reviews: reviewsList,
            avgMarketPrice: 350,
            trustScoreObj: { overall, reliability, quality, punctuality }
          });
        }
      } catch (err) {
        console.error('Error loading worker profile:', err);
        toast.error('Could not load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchWorkerData();
  }, [workerId]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: worker?.name, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Profile link copied!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
        <Loader2 className="animate-spin text-primary-light" size={40} />
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-black p-4 text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Profile not found</h2>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-primary-light text-white rounded-button">Go Back</button>
      </div>
    );
  }

  if (worker.blocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-black p-6 text-center">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert size={40} />
        </div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Profile Disabled</h2>
        <p className="text-gray-650 dark:text-gray-400 max-w-md mb-2">
          Your account has been removed by the administrator.
        </p>
        {worker.removalReason && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-card p-4 text-left max-w-md w-full mb-6">
            <span className="text-xs font-bold text-red-500 block mb-1">REMOVAL REASON:</span>
            <p className="text-sm text-red-700 dark:text-red-400 italic">"{worker.removalReason}"</p>
          </div>
        )}
        <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-gray-250 dark:bg-gray-800 text-gray-800 dark:text-white font-semibold rounded-button">
          Go Home
        </button>
      </div>
    );
  }

  const isPriceFair = (worker.price || 0) <= worker.avgMarketPrice;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-32">
      {/* Cover + Avatar */}
      <div className="relative h-64 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600">
        <button onClick={() => navigate(-1)} className="absolute top-14 left-4 z-10 p-2 bg-black/30 backdrop-blur-sm text-white rounded-full">
          <ArrowLeft size={20} />
        </button>
        <button onClick={handleShare} className="absolute top-14 right-4 z-10 p-2 bg-black/30 backdrop-blur-sm text-white rounded-full">
          <Share2 size={20} />
        </button>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute -bottom-12 left-4 flex items-end gap-4">
          {worker.avatar ? (
            <img src={worker.avatar} alt={worker.name} className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-900 shadow-xl" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-light to-blue-400 flex items-center justify-center text-white font-black text-3xl border-4 border-white dark:border-gray-900 shadow-xl">
              {worker.name.charAt(0)}
            </div>
          )}
        </div>
      </div>

      {/* Worker Info */}
      <div className="px-4 mt-16 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{worker.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 capitalize">{worker.category} • {worker.experience} yrs exp</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-amber-500">★ {worker.rating.toFixed(1)}</span>
              <span className="text-gray-300">•</span>
              <span className="text-sm text-gray-500">{worker.jobs} jobs completed</span>
              <span className="text-gray-300">•</span>
              <span className="text-sm text-gray-500"><MapPin size={12} className="inline text-primary-light" /> {worker.city}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {worker.badge && <Badge variant={worker.badge === 'AI Verified' ? 'ai' : 'primary'}>🤖 {worker.badge}</Badge>}
            {worker.skillLevelBadge && <Badge variant="success">{worker.skillLevelBadge}</Badge>}
            <Badge variant={worker.available ? 'success' : 'default'}>
              {worker.available ? '● Available' : '● Busy'}
            </Badge>
          </div>
        </div>
        {worker.bio && <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{worker.bio}</p>}
      </div>

      {/* AI Trust Score */}
      {worker.trustScoreObj && (
        <div className="mx-4 mb-4 p-6 bg-white dark:bg-surface-dark rounded-card border border-gray-100 dark:border-gray-800 shadow-soft">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 text-sm">
            <span>🤖</span> Gemini AI Trust Score Evaluation
          </h3>
          <div className="flex items-center gap-6">
            <TrustScoreRing score={worker.trustScoreObj.overall} />
            <div className="flex-1 space-y-3">
              <ScoreBar label="Reliability" value={worker.trustScoreObj.reliability} delay={200} />
              <ScoreBar label="Quality" value={worker.trustScoreObj.quality} delay={400} />
              <ScoreBar label="Punctuality" value={worker.trustScoreObj.punctuality} delay={600} />
            </div>
          </div>
        </div>
      )}

      {/* Price Benchmark */}
      <div className={`mx-4 mb-4 p-4 rounded-card border ${isPriceFair ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs font-bold uppercase tracking-wider ${isPriceFair ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {isPriceFair ? '✅ Fair Price' : '⚠️ Above Market'}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">₹{worker.price}<span className="text-sm font-normal text-gray-500">/{worker.pricingType || 'visit'}</span></p>
          </div>
          <div className="text-right text-sm text-gray-500 dark:text-gray-400">
            <p>Market avg</p>
            <p className="font-semibold text-gray-700 dark:text-gray-300">₹{worker.avgMarketPrice}</p>
          </div>
        </div>
      </div>

      {/* Work Photos */}
      {worker.photos && worker.photos.length > 0 && (
        <div className="mx-4 mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Past Work Photos</h3>
          <div className="grid grid-cols-3 gap-2">
            {worker.photos.map((photo, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setLightboxPhoto(i)}
                className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden cursor-pointer border"
              >
                <img src={photo} alt={`Work ${i+1}`} className="w-full h-full object-cover" />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="mx-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white">Reviews</h3>
          <div className="flex items-center gap-1 text-amber-500 text-sm font-bold">
            <Star size={16} fill="currentColor" />
            <span className="font-bold">{worker.rating.toFixed(1)}</span>
            <span className="text-gray-400 font-normal">({worker.reviews?.length || 0})</span>
          </div>
        </div>
        
        {(!worker.reviews || worker.reviews.length === 0) ? (
          <div className="bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 p-6 rounded-card text-center text-sm text-gray-500">
            No customer reviews yet.
          </div>
        ) : (
          <div className="space-y-3">
            {worker.reviews.map((r, i) => (
              <div key={i} className="bg-white dark:bg-surface-dark rounded-card p-4 border border-gray-100 dark:border-gray-800 shadow-soft">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">{r.avatar}</div>
                  <div>
                    <div className="font-semibold text-sm text-gray-900 dark:text-white">{r.author}</div>
                    <div className="text-xs text-gray-400">{r.date}</div>
                  </div>
                  <div className="ml-auto text-amber-400 text-sm">{'★'.repeat(r.rating)}</div>
                </div>
                <p className="text-sm text-gray-650 dark:text-gray-400">{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxPhoto !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={() => setLightboxPhoto(null)}
          >
            <button className="absolute top-4 right-4 text-white p-2" aria-label="Close lightbox"><X size={24} /></button>
            <img src={worker.photos[lightboxPhoto]} alt="Enlarged work photo" className="max-w-full max-h-[80vh] rounded object-contain border border-white/10" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-black border-t border-gray-100 dark:border-gray-900 p-4 flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => navigate(`/chat/${worker.id}`)}
          className="flex-1 py-3 border-2 border-primary-light dark:border-primary-dark text-primary-light dark:text-primary-dark rounded-button font-semibold flex items-center justify-center gap-2"
        >
          <MessageCircle size={18} /> Chat
        </motion.button>
        <motion.button
          disabled={!worker.available}
          whileHover={worker.available ? { scale: 1.02 } : {}}
          whileTap={worker.available ? { scale: 0.98 } : {}}
          onClick={() => navigate(`/book/${worker.id}`)}
          className={`flex-1 py-3 font-semibold flex items-center justify-center gap-2 rounded-button text-white transition-colors ${
            worker.available
              ? 'bg-primary-light dark:bg-primary-dark hover:opacity-95'
              : 'bg-gray-400 dark:bg-gray-800 cursor-not-allowed opacity-50'
          }`}
        >
          {worker.available ? `Book Now ₹${worker.price}` : 'Busy / On a Job'}
        </motion.button>
      </div>
    </div>
  );
};

const Loader2 = ({ size = 24, className }) => (
  <svg className={`animate-spin ${className}`} style={{ width: size, height: size }} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export default WorkerProfile;
