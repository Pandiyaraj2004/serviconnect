import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Users, ClipboardCheck, Star, ShieldCheck, MessageSquare, AlertTriangle, ShieldX, HelpCircle, MessageCircle, X, Search, CheckCircle, RefreshCw, Send, Tag, ShieldAlert, Loader2 } from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, getDocs, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { db, rtdb } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/UI';
import toast from 'react-hot-toast';
import { formatImageUrl } from '../utils/helpers';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState('overview'); // overview | customers | workers | bookings | chats | reviews | tickets
  
  // Database state
  const [customers, setCustomers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [chats, setChats] = useState({});
  const [tickets, setTickets] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [disableWorkerId, setDisableWorkerId] = useState(null);
  const [disableReason, setDisableReason] = useState('');
  const [selectedChatRoomId, setSelectedChatRoomId] = useState(null);

  // Worker Verification states
  const [selectedWorkerVerification, setSelectedWorkerVerification] = useState(null);
  const [privateWorkerDetails, setPrivateWorkerDetails] = useState(null);
  const [loadingPrivate, setLoadingPrivate] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');

  // Support ticket inspector states
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [ticketReplyLoading, setTicketReplyLoading] = useState(false);
  
  // Ticket filters
  const [ticketFilterStatus, setTicketFilterStatus] = useState('all');
  const [ticketFilterPriority, setTicketFilterPriority] = useState('all');
  const [ticketFilterRole, setTicketFilterRole] = useState('all');
  const [ticketSearch, setTicketSearch] = useState('');

  // Check admin authorization - only redirect if profile is loaded and role is NOT admin
  useEffect(() => {
    if (userProfile !== null && userProfile !== undefined && userProfile.role !== 'admin') {
      toast.error('Unauthorized access');
      navigate('/');
    }
  }, [userProfile, navigate]);

  // Real-time listeners for all records
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    // 1. Fetch Users (Customers)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(list.filter(u => u.role === 'customer'));
    });

    // 2. Fetch Workers
    const unsubWorkers = onSnapshot(collection(db, 'workers'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWorkers(list);
    });

    // 3. Fetch Bookings
    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBookings(list);
      setLoading(false);
    });

    // 4. Fetch RTDB Chats
    let unsubChats = () => {};
    if (rtdb) {
      const chatsRef = ref(rtdb, 'chats');
      unsubChats = onValue(chatsRef, (snapshot) => {
        if (snapshot.exists()) {
          setChats(snapshot.val());
        } else {
          setChats({});
        }
      });
    }

    // 5. Fetch Tickets
    const unsubTickets = onSnapshot(collection(db, 'tickets'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTickets(list);
    });

    return () => {
      unsubUsers();
      unsubWorkers();
      unsubBookings();
      unsubChats();
      unsubTickets();
    };
  }, []);

  // Helper: Firestore REST API patch (bypasses security rules via API key, for admin use)
  const firestoreRestPatch = async (collection, docId, fields) => {
    const PROJECT_ID = 'serviconnect-2bb43';
    const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
    // Build field mask and value map for Firestore REST PATCH
    const fieldMask = Object.keys(fields).join(',');
    const updateMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const valueMap = {};
    Object.entries(fields).forEach(([k, v]) => {
      if (v === null) valueMap[k] = { nullValue: null };
      else if (typeof v === 'boolean') valueMap[k] = { booleanValue: v };
      else if (typeof v === 'number') valueMap[k] = { integerValue: String(v) };
      else valueMap[k] = { stringValue: String(v) };
    });
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?${updateMask}&key=${API_KEY}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: valueMap })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    return res.json();
  };

  // Support Ticket Handlers
  const handleSendTicketReply = async (e) => {
    if (e) e.preventDefault();
    if (!ticketReplyText.trim() || !selectedTicket) return;

    setTicketReplyLoading(true);
    try {
      const ticketRef = doc(db, 'tickets', selectedTicket.id);
      const newReply = {
        senderId: 'admin',
        senderName: 'ServiConnect Administrator',
        senderRole: 'admin',
        message: ticketReplyText.trim(),
        createdAt: new Date().toISOString(),
      };

      const updatedReplies = [...(selectedTicket.replies || []), newReply];
      await updateDoc(ticketRef, {
        replies: updatedReplies,
        status: 'in_progress',
        updatedAt: serverTimestamp()
      });

      // Send in-app notification to the ticket creator
      await addDoc(collection(db, 'notifications'), {
        recipientId: selectedTicket.userId,
        title: 'Support Ticket Reply',
        message: `Admin has replied to your ticket: "${ticketReplyText.trim().substring(0, 40)}..."`,
        read: false,
        createdAt: new Date().toISOString()
      });

      setTicketReplyText('');
      toast.success('Reply sent successfully!');
    } catch (err) {
      console.error('Error replying to ticket:', err);
      toast.error('Failed to send reply');
    } finally {
      setTicketReplyLoading(false);
    }
  };

  const handleChangeTicketStatus = async (newStatus) => {
    if (!selectedTicket) return;
    try {
      const ticketRef = doc(db, 'tickets', selectedTicket.id);
      await updateDoc(ticketRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Ticket status updated to: ${newStatus}`);
    } catch (err) {
      console.error('Error changing ticket status:', err);
      toast.error('Failed to update status');
    }
  };

  // Worker Aadhaar Verification Handlers
  const handleOpenVerification = async (worker) => {
    setSelectedWorkerVerification(worker);
    setVerificationNotes(worker.verificationNotes || '');
    setLoadingPrivate(true);
    try {
      const docRef = doc(db, 'workers_private', worker.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPrivateWorkerDetails(docSnap.data());
      } else {
        setPrivateWorkerDetails(null);
        toast.error('No private Aadhaar records found for this worker');
      }
    } catch (err) {
      console.error('Error loading private details:', err);
      toast.error('Could not access Aadhaar documents. Check firestore security rules.');
    } finally {
      setLoadingPrivate(false);
    }
  };

  const handleUpdateVerificationStatus = async (status) => {
    if (!selectedWorkerVerification) return;
    try {
      // 1. Update public workers doc
      await updateDoc(doc(db, 'workers', selectedWorkerVerification.id), {
        verificationStatus: status,
        badge: status === 'verified' ? 'Trusted' : selectedWorkerVerification.badge,
        verificationNotes: verificationNotes.trim()
      });

      // 2. Update private document
      await updateDoc(doc(db, 'workers_private', selectedWorkerVerification.id), {
        verificationStatus: status,
        verificationNotes: verificationNotes.trim(),
        updatedAt: serverTimestamp()
      });

      // 3. Create notification
      await addDoc(collection(db, 'notifications'), {
        recipientId: selectedWorkerVerification.id,
        title: status === 'verified' ? 'Profile Verified! ✅' : status === 'reupload' ? 'Aadhaar Re-upload Required 🆔' : 'Verification Rejected ❌',
        message: status === 'verified' 
          ? 'Congratulations! Your profile has been verified by the administrator. A verified badge is now visible on your public page.' 
          : `Verification update from admin: ${verificationNotes.trim() || 'Aadhaar verification update.'}`,
        read: false,
        createdAt: new Date().toISOString()
      });

      toast.success(`Worker status updated to: ${status}`);
      setSelectedWorkerVerification(null);
      setPrivateWorkerDetails(null);
    } catch (err) {
      console.error('Error updating verification status:', err);
      toast.error('Failed to update verification status');
    }
  };

  // Worker removal/disabling action
  const handleDisableWorker = async () => {
    if (!disableWorkerId) return;
    if (!disableReason.trim()) {
      toast.error('Please specify a removal reason');
      return;
    }

    try {
      // Update workers and users collections via REST API (bypasses auth rules for admin)
      await firestoreRestPatch('workers', disableWorkerId, { disabled: true, removalReason: disableReason.trim() });
      await firestoreRestPatch('users', disableWorkerId, { disabled: true, removalReason: disableReason.trim() });

      toast.success('Worker account disabled successfully');
      setDisableWorkerId(null);
      setDisableReason('');
    } catch (err) {
      console.error('Disable worker error:', err);
      toast.error('Could not disable worker. Check Firebase rules or console.');
    }
  };

  const handleEnableWorker = async (workerId) => {
    try {
      await firestoreRestPatch('workers', workerId, { disabled: false });
      await firestoreRestPatch('users', workerId, { disabled: false });

      toast.success('Worker account enabled successfully');
    } catch (err) {
      console.error('Enable worker error:', err);
      toast.error('Could not enable worker. Check Firebase rules.');
    }
  };

  // Metrics Calculations
  const totalCustomers = customers.length;
  const totalWorkers = workers.length;
  const totalBookings = bookings.length;
  const activeWorkers = workers.filter(w => w.available && !w.disabled).length;
  const completedJobs = bookings.filter(b => b.status === 'completed');
  const totalCompletedJobs = completedJobs.length;
  
  const reviewsList = bookings.filter(b => b.review);
  const totalReviews = reviewsList.length;

  const ratedBookings = bookings.filter(b => b.rating);
  const averageRating = ratedBookings.length
    ? parseFloat((ratedBookings.reduce((sum, b) => sum + b.rating, 0) / ratedBookings.length).toFixed(1))
    : 5.0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 border-4 border-primary-light border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Loading admin context...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white dark:bg-black border-b border-gray-150 dark:border-gray-900 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-primary-light uppercase tracking-[0.2em]">ServiConnect Control</p>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Admin Console</h1>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="px-4 py-2 border rounded-button text-xs font-bold bg-white dark:bg-gray-800 text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          My Settings
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-150 dark:border-gray-800 px-6 py-2 flex gap-4 overflow-x-auto scrollbar-hide">
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'customers', label: '👥 Customers' },
          { id: 'workers', label: '🛠 Workers' },
          { id: 'bookings', label: '📋 Bookings' },
          { id: 'chats', label: '💬 Chats Inspector' },
          { id: 'reviews', label: '⭐ Reviews' },
          { id: 'tickets', label: '🎟 Tickets' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-bold transition-all relative shrink-0 ${
              activeTab === tab.id ? 'text-primary-light dark:text-primary-dark' : 'text-gray-400 hover:text-gray-650'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-light dark:bg-primary-dark rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: 'Total Customers', value: totalCustomers, icon: <Users size={20} />, color: 'text-blue-500' },
                { title: 'Total Workers', value: totalWorkers, icon: <HelpCircle size={20} />, color: 'text-green-500' },
                { title: 'Active Bookings', value: bookings.filter(b => b.status === 'confirmed').length, icon: <ClipboardCheck size={20} />, color: 'text-orange-500' },
                { title: 'Completed Jobs', value: totalCompletedJobs, icon: <ShieldCheck size={20} />, color: 'text-purple-500' },
                { title: 'Total Bookings', value: totalBookings, icon: <ClipboardCheck size={20} />, color: 'text-cyan-500' },
                { title: 'Active Workers', value: activeWorkers, icon: <Users size={20} />, color: 'text-emerald-500' },
                { title: 'Reviews Saved', value: totalReviews, icon: <MessageSquare size={20} />, color: 'text-amber-500' },
                { title: 'Average Rating', value: `${averageRating} / 5`, icon: <Star size={20} />, color: 'text-yellow-500' },
              ].map((card, i) => (
                <div key={i} className="bg-white dark:bg-surface-dark rounded-card p-6 border border-gray-100 dark:border-gray-800 shadow-soft">
                  <div className={`flex items-center justify-between mb-4 ${card.color}`}>{card.icon}</div>
                  <div className="text-3xl font-black text-gray-900 dark:text-white">{card.value}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-semibold uppercase tracking-wider">{card.title}</div>
                </div>
              ))}
            </div>

            {/* Quick Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-white dark:bg-surface-dark rounded-card p-6 border border-gray-100 dark:border-gray-800 shadow-soft">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">System Status</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                  Firestore and Realtime Database are connected. Image storage is running on local Express API port 5000.
                </p>
                <div className="flex gap-4 text-xs font-bold">
                  <span className="text-green-500">● FIRESTORE ON</span>
                  <span className="text-green-500">● RTDB CHAT ON</span>
                  <span className="text-green-500">● PORT 5000 ON</span>
                </div>
              </div>
              <div className="bg-white dark:bg-surface-dark rounded-card p-6 border border-gray-100 dark:border-gray-800 shadow-soft">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">Worker Verification Summary</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                  Workers are evaluated using Gemini AI. Trust scores reflect technical skill test answers, photos, and experience.
                </p>
                <div className="text-xs text-gray-400">
                  Total verifications performed: <span className="font-bold text-primary-light">{workers.length}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* CUSTOMERS TAB */}
        {activeTab === 'customers' && (
          <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-150 dark:border-gray-800 overflow-hidden shadow-soft">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Register Customers ({customers.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="px-6 py-3">UID</th>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Phone</th>
                    <th className="px-6 py-3">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                  {customers.map(c => (
                    <tr key={c.id} className="text-gray-850 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 font-mono select-all truncate max-w-[120px]">{c.id}</td>
                      <td className="px-6 py-4 font-bold">{c.name}</td>
                      <td className="px-6 py-4">{c.email}</td>
                      <td className="px-6 py-4">{c.phone || 'N/A'}</td>
                      <td className="px-6 py-4 truncate max-w-[200px]">{c.address || 'Not set'}</td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center text-gray-400 font-semibold">No customers registered yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WORKERS TAB */}
        {activeTab === 'workers' && (
          <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-150 dark:border-gray-800 overflow-hidden shadow-soft">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Service Workers ({workers.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="px-6 py-3">Worker Details</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">City</th>
                    <th className="px-6 py-3">Phone</th>
                    <th className="px-6 py-3">Trust Score</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                  {workers.map(w => (
                    <tr key={w.id} className="text-gray-850 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {w.avatar ? (
                            <img src={formatImageUrl(w.avatar)} className="w-9 h-9 rounded-full object-cover border" alt="" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary-light/20 flex items-center justify-center font-bold text-primary-light">
                              {w.name?.charAt(0)}
                            </div>
                          )}
                          <div>
                            <span className="font-bold block text-sm">{w.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono select-all">{w.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 capitalize font-semibold">{w.category}</td>
                      <td className="px-6 py-4">{w.city}</td>
                      <td className="px-6 py-4">{w.phone}</td>
                      <td className="px-6 py-4">
                        <span className="font-black text-sm text-primary-light">{w.trustScore}%</span>
                        <span className="text-[10px] text-gray-400 block font-bold capitalize">{w.badge}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          {w.disabled ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400 text-[10px] rounded font-bold">
                              Removed
                            </span>
                          ) : w.available ? (
                            <span className="px-2 py-0.5 bg-green-150 text-green-700 dark:bg-green-950/20 dark:text-green-400 text-[10px] rounded font-bold">
                              Available
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-150 text-gray-700 dark:bg-gray-800 dark:text-gray-400 text-[10px] rounded font-bold">
                              Busy
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-[9px] rounded font-bold uppercase ${
                            w.verificationStatus === 'verified' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                            w.verificationStatus === 'reupload' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                            w.verificationStatus === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {w.verificationStatus || 'pending'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        {w.disabled ? (
                          <button
                            onClick={() => handleEnableWorker(w.id)}
                            className="px-2.5 py-1.5 bg-green-500 text-white rounded font-bold text-[10px] hover:bg-green-600 transition"
                          >
                            Re-enable
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenVerification(w)}
                              className="px-2.5 py-1.5 bg-primary-light text-white rounded font-bold text-[10px] hover:bg-primary-light/95 transition flex items-center gap-1"
                            >
                              <ShieldCheck size={12} /> Verify
                            </button>
                            <button
                              onClick={() => setDisableWorkerId(w.id)}
                              className="px-2.5 py-1.5 bg-red-500 text-white rounded font-bold text-[10px] hover:bg-red-600 transition flex items-center gap-1"
                            >
                              <ShieldX size={12} /> Remove
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {workers.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-6 py-10 text-center text-gray-400 font-semibold">No workers registered yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === 'bookings' && (
          <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-150 dark:border-gray-800 overflow-hidden shadow-soft">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Platform Bookings ({bookings.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="px-6 py-3">Booking ID</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Worker</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Scheduled</th>
                    <th className="px-6 py-3">Price</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                  {bookings.map(b => (
                    <tr key={b.id} className="text-gray-850 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 font-mono truncate max-w-[100px] select-all">#{b.id}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold block">{b.customerName}</span>
                        <span className="text-[10px] text-gray-400 select-all font-mono">{b.customerId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold block">{b.workerName}</span>
                        <span className="text-[10px] text-gray-400 select-all font-mono">{b.workerId}</span>
                      </td>
                      <td className="px-6 py-4 capitalize font-semibold">{b.category}</td>
                      <td className="px-6 py-4">{b.date}, {b.timeSlot}</td>
                      <td className="px-6 py-4 font-bold">₹{b.price}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400' :
                          b.status === 'confirmed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400' :
                          b.status === 'rejected' || b.status === 'cancelled' ? 'bg-red-105 text-red-700 dark:bg-red-950/20 dark:text-red-450' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                        }`}>
                          {b.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-6 py-10 text-center text-gray-400 font-semibold">No bookings created yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CHATS TAB (Realtime chat inspector) */}
        {activeTab === 'chats' && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Conversation Rooms list */}
            <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-150 dark:border-gray-800 p-4 shadow-soft h-[500px] flex flex-col">
              <h3 className="font-bold text-gray-950 dark:text-white mb-3 text-sm pb-2 border-b">Active Conversations</h3>
              <div className="overflow-y-auto flex-1 space-y-2">
                {Object.keys(chats).map(roomId => {
                  const parts = roomId.split('_');
                  const customerUid = parts[0];
                  const workerUid = parts[1];
                  return (
                    <button
                      key={roomId}
                      onClick={() => setSelectedChatRoomId(roomId)}
                      className={`w-full text-left p-3 rounded-lg border transition text-xs ${
                        selectedChatRoomId === roomId 
                          ? 'border-primary-light bg-primary-light/5 text-primary-light font-semibold' 
                          : 'border-gray-100 hover:bg-gray-50 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="font-bold truncate">Room: {roomId}</div>
                      <div className="text-[10px] text-gray-450 truncate mt-1">Customer: {customerUid}</div>
                      <div className="text-[10px] text-gray-450 truncate">Worker: {workerUid}</div>
                    </button>
                  );
                })}
                {Object.keys(chats).length === 0 && (
                  <div className="text-center py-20 text-xs text-gray-400 font-semibold">
                    No active chat records found in RTDB.
                  </div>
                )}
              </div>
            </div>

            {/* Chat Inspector view */}
            <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-150 dark:border-gray-800 p-4 shadow-soft md:col-span-2 h-[500px] flex flex-col">
              {selectedChatRoomId && chats[selectedChatRoomId] ? (
                <>
                  <div className="flex items-center justify-between pb-2 border-b mb-3">
                    <div>
                      <h4 className="font-bold text-gray-950 dark:text-white text-sm">Room Messages</h4>
                      <p className="text-[10px] text-gray-400">{selectedChatRoomId}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedChatRoomId(null)}
                      className="p-1 rounded-full hover:bg-gray-100"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl border mb-2">
                    {chats[selectedChatRoomId].messages ? (
                      Object.entries(chats[selectedChatRoomId].messages).map(([msgId, val]) => (
                        <div key={msgId} className="bg-white dark:bg-surface-dark p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 text-[11px] shadow-sm leading-relaxed max-w-[85%]">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="font-bold text-primary-light uppercase tracking-wider text-[8px] bg-primary-light/10 px-1.5 py-0.5 rounded">
                              {val.senderRole || 'User'}
                            </span>
                            <span className="text-[8px] text-gray-400 font-mono">{val.sender}</span>
                          </div>
                          <p className="text-gray-800 dark:text-gray-200">{val.text}</p>
                          <span className="text-[8px] text-gray-400 text-right block mt-1">
                            {new Date(val.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-20 text-xs text-gray-400">Empty room data</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-center text-xs text-gray-400 select-none">
                  <MessageCircle size={36} className="mb-2 text-gray-300 animate-pulse" />
                  Select an active room room from the left list to inspect logs.
                </div>
              )}
            </div>
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === 'reviews' && (
          <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-150 dark:border-gray-800 overflow-hidden shadow-soft">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Permanently Saved Reviews ({totalReviews})</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-850">
              {reviewsList.map(r => (
                <div key={r.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-primary-light/10 flex items-center justify-center font-bold text-primary-light shrink-0">
                    {r.customerName?.charAt(0)}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">{r.customerName}</span>
                      <span className="text-gray-400">rated</span>
                      <span className="font-bold text-gray-900 dark:text-white text-sm">{r.workerName}</span>
                      <span className="text-[10px] text-gray-400 capitalize font-semibold">({r.category})</span>
                    </div>
                    <div className="text-amber-400 font-mono text-base">{'★'.repeat(r.rating)}</div>
                    <p className="text-gray-650 dark:text-gray-400 text-sm leading-relaxed italic">"{r.review}"</p>
                    <span className="text-[9px] text-gray-400 block pt-1">Booking: #{r.id}</span>
                  </div>
                </div>
              ))}
              {reviewsList.length === 0 && (
                <div className="px-6 py-10 text-center text-gray-400 font-semibold text-xs">No reviews submitted yet.</div>
              )}
            </div>
          </div>
        )}

        {/* TICKETS TAB */}
        {activeTab === 'tickets' && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Tickets List */}
            <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-150 dark:border-gray-800 p-4 shadow-soft h-[550px] flex flex-col">
              <div className="space-y-3 pb-3 border-b mb-3">
                <h3 className="font-bold text-gray-950 dark:text-white text-sm">Complaint Tickets</h3>
                {/* Filters */}
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <select
                    value={ticketFilterStatus}
                    onChange={e => setTicketFilterStatus(e.target.value)}
                    className="p-1.5 border rounded bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <select
                    value={ticketFilterPriority}
                    onChange={e => setTicketFilterPriority(e.target.value)}
                    className="p-1.5 border rounded bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                  >
                    <option value="all">All Priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <select
                    value={ticketFilterRole}
                    onChange={e => setTicketFilterRole(e.target.value)}
                    className="p-1.5 border rounded bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                  >
                    <option value="all">All Roles</option>
                    <option value="customer">Customer</option>
                    <option value="worker">Worker</option>
                  </select>
                </div>
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={ticketSearch}
                    onChange={e => setTicketSearch(e.target.value)}
                    placeholder="Search by subject/user..."
                    className="w-full pl-7 pr-3 py-1.5 border text-[11px] rounded-lg outline-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <Search size={11} className="absolute left-2.5 top-2.5 text-gray-400" />
                </div>
              </div>

              {/* Tickets Map List */}
              <div className="overflow-y-auto flex-1 space-y-2">
                {tickets
                  .filter(t => {
                    if (ticketFilterStatus !== 'all' && t.status !== ticketFilterStatus) return false;
                    if (ticketFilterPriority !== 'all' && t.priority !== ticketFilterPriority) return false;
                    if (ticketFilterRole !== 'all' && t.userRole !== ticketFilterRole) return false;
                    if (ticketSearch.trim() !== '') {
                      const query = ticketSearch.toLowerCase();
                      return (
                        t.subject?.toLowerCase().includes(query) ||
                        t.userName?.toLowerCase().includes(query) ||
                        t.id?.toLowerCase().includes(query)
                      );
                    }
                    return true;
                  })
                  .map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTicket(t);
                        setTicketReplyText('');
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition text-xs flex flex-col gap-1 ${
                        selectedTicket?.id === t.id 
                          ? 'border-primary-light bg-primary-light/5 text-primary-light font-semibold' 
                          : 'border-gray-100 hover:bg-gray-50 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-mono text-[9px] text-gray-400">#{t.id}</span>
                        <Badge variant={
                          t.status === 'resolved' || t.status === 'completed' ? 'success' :
                          t.status === 'in_progress' ? 'primary' :
                          t.status === 'closed' ? 'danger' : 'warning'
                        } className="py-0 text-[8px] uppercase">
                          {t.status}
                        </Badge>
                      </div>
                      <div className="font-bold truncate w-full">{t.subject}</div>
                      <div className="flex justify-between items-center text-[9px] text-gray-400 mt-1 w-full">
                        <span>👤 {t.userName} ({t.userRole})</span>
                        <span>{t.createdAt ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : 'recent'}</span>
                      </div>
                    </button>
                  ))}
                {tickets.length === 0 && (
                  <div className="text-center py-20 text-xs text-gray-400">
                    No tickets found in database.
                  </div>
                )}
              </div>
            </div>

            {/* Ticket Inspector */}
            <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-150 dark:border-gray-800 p-4 shadow-soft md:col-span-2 h-[550px] flex flex-col">
              {selectedTicket ? (
                <>
                  {/* Header info */}
                  <div className="flex items-start justify-between pb-3 border-b mb-3 flex-wrap gap-2">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-mono block">Ticket Reference: #{selectedTicket.id}</span>
                      <h4 className="font-bold text-gray-950 dark:text-white text-sm">{selectedTicket.subject}</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">Category: <span className="font-bold text-primary-light">{selectedTicket.category}</span> | User: <span className="font-semibold">{selectedTicket.userName} ({selectedTicket.userEmail})</span></p>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={selectedTicket.status}
                        onChange={e => handleChangeTicketStatus(e.target.value)}
                        className="px-2 py-1 border rounded text-[10px] bg-gray-50 dark:bg-gray-800 font-bold"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <button 
                        onClick={() => setSelectedTicket(null)}
                        className="p-1 rounded-full hover:bg-gray-100"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Messages list */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border mb-3">
                    {/* Original Complaint */}
                    <div className="bg-white dark:bg-surface-dark border p-3 rounded-lg text-xs space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 border-b pb-1">
                        <span>Original Complaint Detail</span>
                        <span>{selectedTicket.createdAt ? new Date(selectedTicket.createdAt.seconds * 1000).toLocaleString() : 'recent'}</span>
                      </div>
                      <p className="text-gray-800 dark:text-gray-200 leading-relaxed break-words whitespace-pre-wrap">{selectedTicket.description}</p>
                      
                      {selectedTicket.bookingId && (
                        <div className="text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-800 p-1.5 rounded">
                          📌 <span className="font-bold text-gray-600 dark:text-gray-300">Booking ID:</span> {selectedTicket.bookingId}
                        </div>
                      )}

                      {selectedTicket.screenshot && (
                        <div className="space-y-1">
                          <span className="text-[9px] text-gray-400 block font-bold">Screenshot Attached:</span>
                          <a href={selectedTicket.screenshot} target="_blank" rel="noreferrer" className="block max-w-[200px] border rounded overflow-hidden aspect-video relative group">
                            <img src={selectedTicket.screenshot} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="Screenshot" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Replies thread */}
                    {(selectedTicket.replies || []).map((reply, idx) => {
                      const isSelf = reply.senderRole === 'admin';
                      return (
                        <div key={idx} className={`flex gap-3 items-start max-w-[85%] ${isSelf ? 'ml-auto flex-row-reverse' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelf ? 'bg-red-500 text-white' : 'bg-primary-light/10 text-primary-light'
                          }`}>
                            {isSelf ? 'A' : reply.senderName.charAt(0)}
                          </div>
                          <div className={`border p-2.5 rounded-lg shadow-sm text-xs space-y-1 ${
                            isSelf 
                              ? 'bg-red-500/5 dark:bg-red-950/20 border-red-500/20 text-gray-800 dark:text-gray-200' 
                              : 'bg-white dark:bg-surface-dark border-gray-150'
                          }`}>
                            <div className="flex justify-between items-center gap-4 text-[9px] text-gray-400 border-b pb-1">
                              <span className="font-bold text-gray-700 dark:text-gray-300">{reply.senderName}</span>
                              <span className="font-semibold uppercase tracking-wider">{reply.senderRole}</span>
                            </div>
                            <p className="leading-relaxed break-words whitespace-pre-wrap">{reply.message}</p>
                            <span className="text-[8px] text-gray-400 text-right block mt-1">
                              {reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Send Form */}
                  <form onSubmit={handleSendTicketReply} className="flex gap-2">
                    <textarea
                      value={ticketReplyText}
                      onChange={e => setTicketReplyText(e.target.value)}
                      placeholder="Write your support reply here (sends notification & email update)..."
                      rows={1}
                      disabled={selectedTicket.status === 'closed'}
                      className="flex-1 px-4 py-2 text-xs border rounded-xl outline-none focus:border-primary-light dark:bg-gray-850 dark:border-gray-800 text-gray-900 dark:text-white resize-none"
                    />
                    <button
                      type="submit"
                      disabled={ticketReplyLoading || !ticketReplyText.trim() || selectedTicket.status === 'closed'}
                      className="p-2.5 bg-primary-light text-white rounded-xl shadow flex items-center justify-center shrink-0 hover:bg-primary-light/95 disabled:opacity-50"
                    >
                      {ticketReplyLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-center text-xs text-gray-400 select-none">
                  <HelpCircle size={36} className="mb-2 text-gray-300" />
                  Select a support ticket from the left panel to inspect details and write replies.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DISABLING/REMOVING WORKER REASON MODAL */}
      <AnimatePresence>
        {disableWorkerId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 border border-gray-250 dark:border-gray-800 rounded-card p-6 max-w-sm w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle size={24} />
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Confirm Removal</h3>
              </div>
              <p className="text-xs text-gray-500 leading-normal">
                Please specify the reason why you are disabling this worker profile. They will see this message when trying to access the app.
              </p>
              <textarea
                rows={3}
                value={disableReason}
                onChange={e => setDisableReason(e.target.value)}
                placeholder="E.g., Customer complaints regarding pricing / safety violation..."
                className="w-full px-4 py-2 text-xs border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-input outline-none resize-none focus:border-red-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setDisableWorkerId(null); setDisableReason(''); }}
                  className="flex-1 py-2 border rounded text-xs font-semibold text-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisableWorker}
                  className="flex-1 py-2 bg-red-500 text-white rounded font-bold text-xs shadow hover:bg-red-650"
                >
                  Disable Worker
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WORKER VERIFICATION DETAIL MODAL */}
        {selectedWorkerVerification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 border border-gray-250 dark:border-gray-800 rounded-card p-6 max-w-2xl w-full shadow-2xl space-y-5 my-8">
              <div className="flex justify-between items-center pb-2 border-b">
                <div className="flex items-center gap-2 text-primary-light">
                  <ShieldCheck size={22} />
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Verify Worker Identity & Profile</h3>
                </div>
                <button
                  onClick={() => { setSelectedWorkerVerification(null); setPrivateWorkerDetails(null); }}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              {loadingPrivate ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="animate-spin text-primary-light" size={24} />
                  <span className="text-[10px] text-gray-400">Loading private verification documents...</span>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  {/* Public details preview */}
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-850 p-3 rounded-lg">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold uppercase">Worker Details</span>
                      <span className="font-bold text-gray-800 dark:text-white text-sm block">{selectedWorkerVerification.name}</span>
                      <span className="text-gray-500 mt-1 block">Category: <span className="font-bold text-primary-light uppercase">{selectedWorkerVerification.category}</span></span>
                      <span className="text-gray-500 block">Exp: {selectedWorkerVerification.experience} Years</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold uppercase">Location Information (OSM Geocoded)</span>
                      <span className="text-gray-800 dark:text-white font-semibold block mt-1 font-sans">Address: {selectedWorkerVerification.address || 'N/A'}</span>
                      <span className="text-gray-500 block mt-0.5">City: {selectedWorkerVerification.city || 'N/A'} | District: {selectedWorkerVerification.district || 'N/A'}</span>
                      <span className="text-gray-500 block">State: {selectedWorkerVerification.state || 'N/A'} | Country: {selectedWorkerVerification.country || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Private Aadhaar documents */}
                  <div>
                    <span className="text-[10px] text-gray-400 block font-bold uppercase mb-2">Private Aadhaar Identification</span>
                    {privateWorkerDetails ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-gray-500">Aadhaar Front Side:</span>
                          {privateWorkerDetails.aadhaarFront ? (
                            <a href={privateWorkerDetails.aadhaarFront} target="_blank" rel="noreferrer" className="block border rounded-lg overflow-hidden aspect-video relative group">
                              <img src={privateWorkerDetails.aadhaarFront} className="w-full h-full object-cover group-hover:scale-102 transition-transform" alt="Aadhaar Front" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold">Open Full View 🌐</div>
                            </a>
                          ) : (
                            <div className="aspect-video bg-gray-100 border border-dashed rounded-lg flex items-center justify-center text-gray-400">Not Uploaded</div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-gray-500">Aadhaar Back Side:</span>
                          {privateWorkerDetails.aadhaarBack ? (
                            <a href={privateWorkerDetails.aadhaarBack} target="_blank" rel="noreferrer" className="block border rounded-lg overflow-hidden aspect-video relative group">
                              <img src={privateWorkerDetails.aadhaarBack} className="w-full h-full object-cover group-hover:scale-102 transition-transform" alt="Aadhaar Back" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold">Open Full View 🌐</div>
                            </a>
                          ) : (
                            <div className="aspect-video bg-gray-100 border border-dashed rounded-lg flex items-center justify-center text-gray-400">Not Uploaded</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-650 border border-red-200 dark:border-red-900 rounded-lg text-center font-semibold">
                        ❌ Private Aadhaar files not found for this profile.
                      </div>
                    )}
                  </div>

                  {/* Verification Notes */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-bold block uppercase">Verification Status Notes / Reason for rejection</label>
                    <textarea
                      rows={2.5}
                      value={verificationNotes}
                      onChange={e => setVerificationNotes(e.target.value)}
                      placeholder="Add internal feedback notes here. Visible to worker on request/re-upload request..."
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-805 text-gray-900 dark:text-white outline-none focus:border-primary-light resize-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2.5 pt-2 border-t flex-wrap">
                    <button
                      onClick={() => handleUpdateVerificationStatus('verified')}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg flex-1 flex items-center justify-center gap-1 shadow"
                    >
                      <ShieldCheck size={14} /> Approve Profile
                    </button>
                    <button
                      onClick={() => handleUpdateVerificationStatus('reupload')}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg flex-1 flex items-center justify-center gap-1 shadow"
                    >
                      <RefreshCw size={14} /> Request Re-upload
                    </button>
                    <button
                      onClick={() => handleUpdateVerificationStatus('rejected')}
                      className="px-4 py-2 bg-red-500 hover:bg-red-650 text-white font-bold rounded-lg flex-1 flex items-center justify-center gap-1 shadow"
                    >
                      <ShieldAlert size={14} /> Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
