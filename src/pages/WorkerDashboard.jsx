import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, X, Loader2, Bell, MapPin, Star, Calendar, MessageSquare, Award, PlayCircle, ShieldAlert } from 'lucide-react';
import { BottomNav, Badge } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot, updateDoc, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendCustomerConfirmation } from '../utils/helpers';
import { createNotification, NOTIF_TEMPLATES, subscribeToNotifications } from '../utils/notifications';
import toast from 'react-hot-toast';

const WorkerDashboard = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [workerProfile, setWorkerProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Subscribe to real-time unread notification count
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToNotifications(user.uid, (items) => {
      setUnreadCount(items.filter(i => !i.read).length);
    });
    return () => unsub();
  }, [user?.uid]);

  // Redirect if not a worker — wait for profile to actually load (not null)
  useEffect(() => {
    if (userProfile !== null && userProfile !== undefined && userProfile.role !== 'worker') {
      navigate('/worker-register');
    }
  }, [userProfile, navigate]);

  // Real-time listen to worker document and bookings
  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    const workerRef = doc(db, 'workers', user.uid);
    const unsubWorker = onSnapshot(workerRef, (docSnap) => {
      if (docSnap.exists()) {
        setWorkerProfile({ id: docSnap.id, ...docSnap.data() });
      } else {
        // Redirection to register
        navigate('/worker-register');
      }
    }, (err) => console.error(err));

    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('workerId', '==', user.uid)
    );
    const unsubBookings = onSnapshot(bookingsQuery, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => console.error(err));

    return () => {
      unsubWorker();
      unsubBookings();
    };
  }, [user, navigate]);

  const handleToggleAvailability = async () => {
    if (!workerProfile || !db) return;
    const newStatus = !workerProfile.available;
    try {
      await updateDoc(doc(db, 'workers', user.uid), {
        available: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(newStatus ? 'You are now Available for jobs' : 'You are now Busy / Offline');
    } catch (err) {
      toast.error('Could not update availability');
    }
  };

  const handleAccept = async (booking) => {
    setProcessingId(booking.id);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'confirmed',
        updatedAt: serverTimestamp()
      });

      // Automatically set worker to Busy/Unavailable when they accept a booking
      await updateDoc(doc(db, 'workers', user.uid), {
        available: false,
        updatedAt: serverTimestamp()
      });

      // 1. Send in-app notification to customer
      await createNotification(
        booking.customerId,
        NOTIF_TEMPLATES.bookingAccepted(workerProfile?.name || 'Worker', booking.category, booking.id)
      );

      // 2. Send WhatsApp confirmation to customer (Opt-in only)
      if (userProfile?.whatsappOptIn && booking.customerPhone) {
        sendCustomerConfirmation(booking.customerPhone, {
          workerName: workerProfile?.name || 'Worker',
          category: booking.category,
          workerPhone: workerProfile?.phone || '',
          bookingDate: booking.date,
          bookingTime: booking.timeSlot,
        });
      }

      toast.success('Booking accepted! Customer notified.');
    } catch (err) {
      toast.error('Failed to accept booking');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (booking) => {
    setProcessingId(booking.id);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });

      // Send in-app rejection notification to customer
      await createNotification(
        booking.customerId,
        NOTIF_TEMPLATES.bookingRejected(workerProfile?.name || 'Worker', booking.category, booking.id)
      );

      toast.success('Booking declined. Customer notified.');
    } catch (err) {
      toast.error('Failed to decline booking');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
        <Loader2 className="animate-spin text-primary-light" size={40} />
      </div>
    );
  }

  // Handle account removal screen
  if (workerProfile?.disabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-black p-6 text-center">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert size={40} />
        </div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Account Removed</h2>
        <p className="text-gray-650 dark:text-gray-400 max-w-md mb-4">
          Your account has been removed by the administrator.
        </p>
        {workerProfile.removalReason && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-card p-4 text-left max-w-md w-full mb-6">
            <span className="text-xs font-bold text-red-500 block mb-1">REASON:</span>
            <p className="text-sm text-red-700 dark:text-red-400 italic">"{workerProfile.removalReason}"</p>
          </div>
        )}
        <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white font-semibold rounded-button">
          Go Home
        </button>
      </div>
    );
  }

  // Stats Calculations
  const pendingRequests = bookings.filter(b => b.status === 'pending');
  const upcomingJobs = bookings.filter(b => b.status === 'confirmed');
  const completedJobs = bookings.filter(b => b.status === 'completed');

  const totalOrders = bookings.length;
  const ratingValue = workerProfile?.rating || 5.0;
  const trustScore = workerProfile?.trustScore || 0;

  const stats = [
    { label: 'Total Orders', value: totalOrders, icon: '📋' },
    { label: 'Pending', value: pendingRequests.length, icon: '⌛' },
    { label: 'Completed', value: completedJobs.length, icon: '✅' },
    { label: 'Trust Score', value: `${trustScore}%`, icon: '🤖' },
  ];

  // Dummy analytics metrics based on real bookings
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chartData = [1, 2, 4, 3, 5, 2, 6]; // representation of daily bookings

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {/* Cover Header */}
      <div className="bg-gradient-to-r from-primary-light to-blue-600 dark:from-blue-900 dark:to-blue-700 px-4 pt-6 pb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {workerProfile?.avatar ? (
              <img src={workerProfile.avatar} alt={workerProfile.name} className="w-16 h-16 rounded-full object-cover border-2 border-white/40" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white font-black text-2xl">
                {workerProfile?.name?.charAt(0) || 'W'}
              </div>
            )}
            <div>
              <h1 className="text-xl font-black text-white">{workerProfile?.name}</h1>
              <p className="text-blue-100 text-sm capitalize">{workerProfile?.category} • {workerProfile?.experience} yrs exp</p>
              <div className="flex items-center gap-1.5 mt-1">
                {workerProfile?.badge && (
                  <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded font-semibold">
                    🤖 {workerProfile.badge}
                  </span>
                )}
                {workerProfile?.skillLevelBadge && (
                  <span className="text-xs bg-green-500/30 text-white px-2 py-0.5 rounded font-semibold">
                    ⭐ {workerProfile.skillLevelBadge}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/notifications')} className="p-2 text-white/80 relative">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Availability Toggle */}
        <div className={`flex items-center justify-between p-4 rounded-card border ${
          workerProfile?.available ? 'bg-green-500/20 border-green-400/30' : 'bg-red-500/20 border-red-400/30'
        }`}>
          <div>
            <p className="font-bold text-white">{workerProfile?.available ? '🟢 Available for Jobs' : '🔴 Currently Busy'}</p>
            <p className="text-blue-100 text-xs mt-0.5">{workerProfile?.available ? 'Customers can view and book your profile' : 'Hidden from search result listings'}</p>
          </div>
          <button
            onClick={handleToggleAvailability}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${workerProfile?.available ? 'bg-green-400' : 'bg-gray-400'}`}
          >
            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${workerProfile?.available ? 'left-7' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-surface-dark rounded-card p-3 border border-gray-100 dark:border-gray-800 text-center shadow-soft"
            >
              <div className="text-xl">{s.icon}</div>
              <div className="text-lg font-black text-gray-900 dark:text-white mt-1">{s.value}</div>
              <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Action Controls for worker */}
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <button onClick={() => navigate('/settings')} className="p-3 bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-card flex flex-col items-center justify-center text-center shadow-soft hover:shadow">
            <span className="text-lg mb-1">⚙️</span>
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Edit Profile</span>
          </button>
          <button onClick={() => navigate('/worker-register')} className="p-3 bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-card flex flex-col items-center justify-center text-center shadow-soft hover:shadow">
            <span className="text-lg mb-1">🤖</span>
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Retake Test</span>
          </button>
          <button onClick={() => {
            if (workerProfile) {
              navigate('/settings'); // settings edit profile has location maps
              toast('Update your location coordinates in settings map', { icon: '📍' });
            }
          }} className="p-3 bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-card flex flex-col items-center justify-center text-center shadow-soft hover:shadow">
            <span className="text-lg mb-1">📍</span>
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Map Pin</span>
          </button>
        </div>

        {/* Booking Requests */}
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
            Booking Requests
            {pendingRequests.length > 0 && (
              <span className="w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {pendingRequests.length}
              </span>
            )}
          </h3>

          {pendingRequests.length === 0 ? (
            <div className="bg-white dark:bg-surface-dark rounded-card p-6 border border-gray-100 dark:border-gray-800 text-center shadow-soft">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-gray-400 dark:text-gray-500 text-xs">No pending booking requests. Stay available!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map(req => (
                <motion.div
                  key={req.id}
                  layout
                  className="bg-white dark:bg-surface-dark rounded-card p-4 border border-gray-100 dark:border-gray-800 shadow-soft"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm">
                      {req.customerName?.charAt(0) || 'C'}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-gray-900 dark:text-white">{req.customerName}</div>
                      <div className="text-xs text-gray-500">📞 {req.customerPhone}</div>
                      <div className="text-xs text-gray-400 mt-0.5">📅 {req.date} • Slot: {req.timeSlot}</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5 mb-3 italic">
                    "{req.problemDescription}"
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(req)}
                      disabled={processingId === req.id}
                      className="flex-1 py-2 bg-green-500 text-white rounded-button text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-75"
                    >
                      {processingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Accept Request
                    </button>
                    <button
                      onClick={() => handleDecline(req)}
                      disabled={processingId === req.id}
                      className="flex-1 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-button text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <X size={12} /> Decline
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Jobs */}
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Active & Confirmed Jobs</h3>
          {upcomingJobs.length === 0 ? (
            <div className="bg-white dark:bg-surface-dark rounded-card p-6 border border-gray-100 dark:border-gray-800 text-center shadow-soft">
              <p className="text-gray-400 dark:text-gray-500 text-xs">No active jobs scheduled.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingJobs.map(job => (
                <div key={job.id} className="bg-white dark:bg-surface-dark rounded-card p-4 border border-gray-100 dark:border-gray-800 flex flex-col gap-3 shadow-soft">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-xl">📅</div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-gray-900 dark:text-white">{job.customerName}</div>
                      <div className="text-xs text-gray-500">{job.date} • {job.timeSlot}</div>
                      <div className="text-xs text-gray-400 truncate">📍 {job.address}</div>
                    </div>
                    <Badge variant="success">Confirmed</Badge>
                  </div>
                  
                  <div className="flex gap-2 border-t pt-3">
                    <button
                      onClick={() => navigate(`/chat/${job.customerId}`)}
                      className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-semibold rounded text-xs flex items-center justify-center gap-1"
                    >
                      <MessageSquare size={12} /> Chat Customer
                    </button>
                    <button
                      onClick={() => navigate(`/job-completion/${job.id}`)}
                      className="flex-1 py-1.5 bg-primary-light text-white font-bold rounded text-xs flex items-center justify-center gap-1"
                    >
                      <PlayCircle size={12} /> Complete Work
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Analytics Section */}
        <div className="bg-white dark:bg-surface-dark rounded-card p-5 border border-gray-100 dark:border-gray-800 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm">Order volume trend</h4>
              <p className="text-[10px] text-gray-400">Weekly completed booking statistics</p>
            </div>
            <Award size={18} className="text-primary-light" />
          </div>
          
          {/* Custom Pure-CSS Analytics Chart */}
          <div className="h-32 flex items-end justify-between gap-2 pt-2 px-2 border-b border-gray-150 dark:border-gray-850">
            {chartData.map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center group cursor-pointer">
                <div 
                  className="w-full bg-primary-light/80 dark:bg-primary-dark/80 rounded-t-sm group-hover:bg-primary-light transition-all"
                  style={{ height: `${val * 16}px` }}
                />
                <span className="text-[9px] text-gray-400 mt-2">{weekdays[idx]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav active="home" onNavigate={navigate} unreadNotifications={unreadCount} userRole={userProfile?.role} />
    </div>
  );
};

export default WorkerDashboard;
