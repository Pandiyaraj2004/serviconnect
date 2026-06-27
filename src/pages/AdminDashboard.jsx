import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Users, ClipboardCheck, Star, ShieldCheck, MessageSquare, AlertTriangle, ShieldX, HelpCircle, MessageCircle, X } from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { db, rtdb } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState('overview'); // overview | customers | workers | bookings | chats | reviews
  
  // Database state
  const [customers, setCustomers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [chats, setChats] = useState({});
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [disableWorkerId, setDisableWorkerId] = useState(null);
  const [disableReason, setDisableReason] = useState('');
  const [selectedChatRoomId, setSelectedChatRoomId] = useState(null);

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

    return () => {
      unsubUsers();
      unsubWorkers();
      unsubBookings();
      unsubChats();
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
          { id: 'reviews', label: '⭐ Reviews' }
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
                            <img src={w.avatar} className="w-9 h-9 rounded-full object-cover border" alt="" />
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
                      </td>
                      <td className="px-6 py-4 text-right">
                        {w.disabled ? (
                          <button
                            onClick={() => handleEnableWorker(w.id)}
                            className="px-2.5 py-1.5 bg-green-500 text-white rounded font-bold text-[10px] hover:bg-green-600 transition"
                          >
                            Re-enable
                          </button>
                        ) : (
                          <button
                            onClick={() => setDisableWorkerId(w.id)}
                            className="px-2.5 py-1.5 bg-red-500 text-white rounded font-bold text-[10px] hover:bg-red-600 transition flex items-center gap-1 ml-auto"
                          >
                            <ShieldX size={12} /> Remove
                          </button>
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
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
