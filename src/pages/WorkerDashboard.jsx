import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, X, Loader2, Bell, MapPin, Star, Calendar, MessageSquare, Award, PlayCircle, ShieldAlert } from 'lucide-react';
import { BottomNav, Badge } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot, updateDoc, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendCustomerConfirmation, formatImageUrl } from '../utils/helpers';
import { createNotification, NOTIF_TEMPLATES, subscribeToNotifications } from '../utils/notifications';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import toast from 'react-hot-toast';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

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
    const hasActiveJob = bookings.some(b => b.status === 'confirmed');
    if (hasActiveJob) {
      toast.error('You have an active booking. Availability will be enabled automatically after the job is completed.');
      return;
    }
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
    const hasActiveJob = bookings.some(b => b.status === 'confirmed');
    if (hasActiveJob) {
      toast.error('You already have an active booking. Complete it before accepting another.');
      return;
    }
    setProcessingId(booking.id);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'confirmed',
        updatedAt: serverTimestamp()
      });

      // Automatically set worker to Busy/Unavailable when they accept a booking
      await updateDoc(doc(db, 'workers', user.uid), {
        available: false,
        activeBookingId: booking.id,
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
  const hasActiveJob = upcomingJobs.length > 0;
  const completedJobs = bookings.filter(b => b.status === 'completed');
  const cancelledJobs = bookings.filter(b => b.status === 'cancelled');
  const rejectedJobs = bookings.filter(b => b.status === 'rejected');

  const totalOrders = bookings.length;
  
  // Real-time aggregates
  const completedCount = completedJobs.length;
  const cancelledCount = cancelledJobs.length;
  const rejectedCount = rejectedJobs.length;
  
  const totalEarnings = completedJobs.reduce((sum, b) => sum + (parseFloat(b.price) || 0), 0);
  
  const monthlyEarnings = completedJobs.reduce((sum, b) => {
    if (b.createdAt) {
      const bDate = new Date(b.createdAt.seconds * 1000);
      const now = new Date();
      if (bDate.getFullYear() === now.getFullYear() && bDate.getMonth() === now.getMonth()) {
        return sum + (parseFloat(b.price) || 0);
      }
    }
    return sum;
  }, 0);

  const ratedBookings = completedJobs.filter(b => b.rating);
  const averageRating = ratedBookings.length
    ? parseFloat((ratedBookings.reduce((sum, b) => sum + b.rating, 0) / ratedBookings.length).toFixed(1))
    : 5.0;
  const totalReviews = ratedBookings.length;

  const stats = [
    { label: 'Completed Jobs', value: completedCount, icon: '✅' },
    { label: 'Monthly Earnings', value: `₹${monthlyEarnings}`, icon: '💰' },
    { label: 'Total Earnings', value: `₹${totalEarnings}`, icon: '💳' },
    { label: 'Average Rating', value: `${averageRating} ★ (${totalReviews})`, icon: '⭐' },
  ];

  // Helper for Chart 6-months trends labels
  const getLast6MonthsLabels = () => {
    const labels = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      labels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
    }
    return labels;
  };

  // 1. Earnings Trend dataset (6 months)
  const last6MonthsEarnings = Array(6).fill(0);
  completedJobs.forEach(b => {
    if (b.createdAt) {
      const bDate = new Date(b.createdAt.seconds * 1000);
      const now = new Date();
      const diffMonths = (now.getFullYear() - bDate.getFullYear()) * 12 + (now.getMonth() - bDate.getMonth());
      if (diffMonths >= 0 && diffMonths < 6) {
        last6MonthsEarnings[5 - diffMonths] += (parseFloat(b.price) || 0);
      }
    }
  });

  // 2. Day of Week Orders dataset
  const ordersPerDayOfWeek = Array(7).fill(0);
  const daysLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  bookings.forEach(b => {
    if (b.createdAt) {
      const bDate = new Date(b.createdAt.seconds * 1000);
      let dayIndex = bDate.getDay() - 1;
      if (dayIndex < 0) dayIndex = 6;
      ordersPerDayOfWeek[dayIndex]++;
    }
  });

  // 3. Completed Jobs per Month dataset (6 months)
  const last6MonthsJobsCount = Array(6).fill(0);
  completedJobs.forEach(b => {
    if (b.createdAt) {
      const bDate = new Date(b.createdAt.seconds * 1000);
      const now = new Date();
      const diffMonths = (now.getFullYear() - bDate.getFullYear()) * 12 + (now.getMonth() - bDate.getMonth());
      if (diffMonths >= 0 && diffMonths < 6) {
        last6MonthsJobsCount[5 - diffMonths]++;
      }
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {/* Cover Header */}
      <div className="bg-gradient-to-r from-primary-light to-blue-600 dark:from-blue-900 dark:to-blue-700 px-4 pt-6 pb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {workerProfile?.avatar ? (
              <img src={formatImageUrl(workerProfile.avatar)} alt={workerProfile.name} className="w-16 h-16 rounded-full object-cover border-2 border-white/40" />
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
        } ${hasActiveJob ? 'opacity-80' : ''}`}>
          <div>
            <p className="font-bold text-white">{workerProfile?.available ? '🟢 Available for Jobs' : '🔴 Currently Busy'}</p>
            {hasActiveJob ? (
              <p className="text-amber-200 text-xs mt-0.5 font-semibold">
                ⚠️ You have an active booking. Availability will be enabled automatically after the job is completed.
              </p>
            ) : (
              <p className="text-blue-100 text-xs mt-0.5">
                {workerProfile?.available ? 'Customers can view and book your profile' : 'Hidden from search result listings'}
              </p>
            )}
          </div>
          <button
            onClick={handleToggleAvailability}
            disabled={hasActiveJob}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${hasActiveJob ? 'cursor-not-allowed opacity-50' : ''} ${workerProfile?.available ? 'bg-green-400' : 'bg-gray-400'}`}
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
                      disabled={processingId === req.id || hasActiveJob}
                      className="flex-1 py-2 bg-green-500 text-white rounded-button text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
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
        <div className="bg-white dark:bg-surface-dark rounded-card p-5 border border-gray-100 dark:border-gray-800 shadow-soft space-y-6">
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Dashboard Analytics & Trends</h4>
            <p className="text-[10px] text-gray-400">Real-time charts aggregated from your customer bookings</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Earnings Chart */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-3">💰 Earnings Trend (Last 6 Months)</span>
              <div className="h-44">
                <Line
                  data={{
                    labels: getLast6MonthsLabels(),
                    datasets: [{
                      label: 'Earnings (₹)',
                      data: last6MonthsEarnings,
                      borderColor: '#3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      tension: 0.3,
                      fill: true
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { ticks: { font: { size: 9 } } }, x: { ticks: { font: { size: 9 } } } }
                  }}
                />
              </div>
            </div>

            {/* Order Volume Trend */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-3">📅 Bookings by Day of Week</span>
              <div className="h-44">
                <Bar
                  data={{
                    labels: daysLabels,
                    datasets: [{
                      label: 'Orders',
                      data: ordersPerDayOfWeek,
                      backgroundColor: '#10b981',
                      borderRadius: 4
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { ticks: { font: { size: 9 } } }, x: { ticks: { font: { size: 9 } } } }
                  }}
                />
              </div>
            </div>

            {/* Monthly Performance */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-3">📈 Completed Orders per Month</span>
              <div className="h-44">
                <Bar
                  data={{
                    labels: getLast6MonthsLabels(),
                    datasets: [{
                      label: 'Jobs',
                      data: last6MonthsJobsCount,
                      backgroundColor: '#6366f1',
                      borderRadius: 4
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { ticks: { font: { size: 9 } } }, x: { ticks: { font: { size: 9 } } } }
                  }}
                />
              </div>
            </div>

            {/* Job Completion Rate */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-3">🔄 Job Completion Rate</span>
              <div className="h-44 flex items-center justify-center">
                {completedCount || cancelledCount || rejectedCount ? (
                  <Doughnut
                    data={{
                      labels: ['Completed', 'Cancelled', 'Rejected'],
                      datasets: [{
                        data: [completedCount, cancelledCount, rejectedCount],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 1
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { labels: { font: { size: 9 } } } }
                    }}
                  />
                ) : (
                  <span className="text-[10px] text-gray-400">No booking statistics yet.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="home" onNavigate={navigate} unreadNotifications={unreadCount} userRole={userProfile?.role} />
    </div>
  );
};

export default WorkerDashboard;
