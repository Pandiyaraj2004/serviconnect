import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, Plus, Send, Loader2, ArrowLeft, MessageSquare, AlertCircle, Calendar, ShieldCheck, Tag, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Badge } from '../components/UI';
import { compressImage } from '../utils/imageCompression';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SupportPage = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  
  // New ticket form state
  const [showRaiseForm, setShowRaiseForm] = useState(false);
  const [category, setCategory] = useState('Booking Issue');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [screenshot, setScreenshot] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Thread reply state
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // Subscribe to user tickets in real-time
  useEffect(() => {
    if (!db || !user?.uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side by date descending
      list.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
      setTickets(list);
      
      // Keep selected ticket details in sync with database updates
      if (selectedTicket) {
        const updated = list.find(t => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading tickets:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, selectedTicket?.id]);

  const handleScreenshotChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, JPEG, PNG, and WEBP images are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploadingFile(true);
    setUploadProgress(0);
    const toastId = toast.loading('Compressing screenshot...');
    try {
      const compressed = await compressImage(file);
      toast.loading('Uploading screenshot...', { id: toastId });
      
      const formData = new FormData();
      formData.append('image', compressed);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/upload/ticket-attachment`, true);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      });

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Invalid response')); }
          } else { reject(new Error('Upload failed')); }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });

      const res = await uploadPromise;
      if (res.url) {
        setScreenshot(res.url);
        toast.success('Screenshot uploaded successfully!', { id: toastId });
      }
    } catch (err) {
      toast.error(`Upload failed: ${err.message}`, { id: toastId });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error('Subject and description are required');
      return;
    }

    setSubmittingTicket(true);
    try {
      await addDoc(collection(db, 'tickets'), {
        userId: user.uid,
        userName: userProfile?.name || user.displayName || 'Anonymous User',
        userRole: userProfile?.role || 'customer',
        userEmail: user.email || '',
        category,
        subject: subject.trim(),
        description: description.trim(),
        bookingId: bookingId.trim() || null,
        screenshot: screenshot || null,
        status: 'open', // open, in_progress, resolved, closed
        priority, // low, medium, high
        replies: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success('Complaint ticket raised successfully');
      setSubject('');
      setDescription('');
      setBookingId('');
      setScreenshot('');
      setShowRaiseForm(false);
    } catch (err) {
      toast.error('Failed to submit support ticket');
      console.error(err);
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    setReplyLoading(true);
    try {
      const ticketRef = doc(db, 'tickets', selectedTicket.id);
      const newReply = {
        senderId: user.uid,
        senderName: userProfile?.name || user.displayName || 'User',
        senderRole: userProfile?.role || 'customer',
        message: replyText.trim(),
        createdAt: new Date().toISOString(),
      };

      const updatedReplies = [...(selectedTicket.replies || []), newReply];
      await updateDoc(ticketRef, {
        replies: updatedReplies,
        status: selectedTicket.status === 'closed' ? 'closed' : 'open',
        updatedAt: serverTimestamp()
      });

      setReplyText('');
      toast.success('Message sent to support');
    } catch (err) {
      toast.error('Failed to send message');
      console.error(err);
    } finally {
      setReplyLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-primary-light/10 text-primary-light rounded-full flex items-center justify-center mb-6">
          <HelpCircle size={32} />
        </div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Help & Support Desk</h1>
        <p className="text-gray-550 dark:text-gray-400 max-w-sm mb-6 leading-relaxed text-sm">
          Please log in to raise complaint tickets, view your messages, and discuss issues with our support team.
        </p>
        <button
          onClick={() => navigate('/login', { state: { from: { pathname: '/support' } } })}
          className="px-6 py-2.5 bg-primary-light text-white font-bold rounded-button text-sm"
        >
          Log In / Sign Up
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-105 dark:hover:bg-gray-800">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Help & Support</h1>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Raise Complaints & Track Issues</p>
          </div>
        </div>
        {!showRaiseForm && !selectedTicket && (
          <button
            onClick={() => setShowRaiseForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-light text-white rounded-button text-xs font-bold shadow-soft"
          >
            <Plus size={14} /> Raise Complaint
          </button>
        )}
      </div>

      <div className="px-4 py-6 max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {/* Raising Form */}
          {showRaiseForm ? (
            <motion.div
              key="raise-form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-white dark:bg-surface-dark border rounded-card p-6 shadow-soft space-y-4 max-w-lg mx-auto"
            >
              <div className="flex justify-between items-center pb-2 border-b">
                <h2 className="font-black text-gray-900 dark:text-white text-lg">New Complaint Ticket</h2>
                <button type="button" onClick={() => setShowRaiseForm(false)} className="p-1 rounded-full hover:bg-gray-150"><X size={16} /></button>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Category *</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                    >
                      <option value="Booking Issue">Booking Issue</option>
                      <option value="Worker Conduct">Worker Conduct</option>
                      <option value="Payment Dispute">Payment Dispute</option>
                      <option value="App Bug">App Bug</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Subject *</label>
                  <input
                    type="text"
                    required
                    placeholder="Briefly state the issue..."
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-primary-light"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Booking ID (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 5xYsYhBqP9..."
                      value={bookingId}
                      onChange={e => setBookingId(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Attach Screenshot (Optional)</label>
                    <div className="flex items-center gap-3">
                      {screenshot ? (
                        <div className="w-10 h-10 border rounded overflow-hidden bg-gray-100 flex-shrink-0 relative">
                          <img src={screenshot} className="w-full h-full object-cover" alt="" />
                          <button type="button" onClick={() => setScreenshot('')} className="absolute inset-0 bg-black/40 flex items-center justify-center text-white"><X size={10} /></button>
                        </div>
                      ) : (
                        <div className="w-10 h-10 border border-dashed rounded bg-gray-50 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">📸</div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        id="screenshot-attachment"
                        className="hidden"
                        onChange={handleScreenshotChange}
                        disabled={uploadingFile}
                      />
                      <label htmlFor="screenshot-attachment" className={`px-3 py-1.5 border rounded-lg text-xs cursor-pointer bg-gray-100 dark:bg-gray-850 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-semibold ${uploadingFile ? 'opacity-50 pointer-events-none' : ''}`}>
                        {uploadingFile ? `Uploading (${uploadProgress}%)` : 'Upload File'}
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Detailed Description *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Provide full details of your complaint. Support team will get back here soon..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-primary-light resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingTicket || uploadingFile}
                  className="w-full py-2.5 bg-primary-light text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow disabled:opacity-75"
                >
                  {submittingTicket ? <Loader2 size={14} className="animate-spin" /> : null}
                  Submit Ticket
                </button>
              </form>
            </motion.div>
          ) : selectedTicket ? (
            /* Detailed Ticket Thread View */
            <motion.div
              key="ticket-thread"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid gap-6 md:grid-cols-3"
            >
              {/* Ticket Details Info Column */}
              <div className="bg-white dark:bg-surface-dark border rounded-card p-5 space-y-4 shadow-soft h-fit">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-805 dark:hover:bg-gray-750 text-gray-750 dark:text-gray-300 font-semibold rounded text-xs flex items-center justify-center gap-1.5"
                >
                  ← Back to Tickets
                </button>
                <div className="border-t pt-3 space-y-2">
                  <div>
                    <span className="text-[10px] text-gray-400 font-mono block uppercase">Ticket ID</span>
                    <span className="text-xs font-semibold font-mono text-gray-800 dark:text-white">#{selectedTicket.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Category</span>
                    <span className="text-xs font-bold text-primary-light capitalize">{selectedTicket.category}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Status</span>
                    <Badge variant={
                      selectedTicket.status === 'completed' || selectedTicket.status === 'resolved' ? 'success' :
                      selectedTicket.status === 'in_progress' ? 'primary' :
                      selectedTicket.status === 'closed' ? 'danger' : 'warning'
                    } className="mt-0.5 capitalize">
                      {selectedTicket.status}
                    </Badge>
                  </div>
                  {selectedTicket.bookingId && (
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Booking Reference</span>
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-250 truncate block">#{selectedTicket.bookingId}</span>
                    </div>
                  )}
                  {selectedTicket.screenshot && (
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase mb-1">Attached Screenshot</span>
                      <a href={selectedTicket.screenshot} target="_blank" rel="noreferrer" className="block border rounded overflow-hidden aspect-video relative group">
                        <img src={selectedTicket.screenshot} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="Complaint screenshot" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">View Fullsize</div>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Thread Messages Box */}
              <div className="bg-white dark:bg-surface-dark border rounded-card shadow-soft md:col-span-2 flex flex-col h-[500px]">
                {/* Header */}
                <div className="px-5 py-4 border-b flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate max-w-sm">{selectedTicket.subject}</h3>
                    <p className="text-[10px] text-gray-400">Raised on {selectedTicket.createdAt ? new Date(selectedTicket.createdAt.seconds * 1000).toLocaleDateString() : 'recent'}</p>
                  </div>
                </div>

                {/* Messages list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50">
                  {/* Creator original description */}
                  <div className="flex gap-3 items-start max-w-[85%]">
                    <div className="w-8 h-8 rounded-full bg-primary-light/10 text-primary-light flex items-center justify-center font-bold text-xs shrink-0">
                      {selectedTicket.userName.charAt(0)}
                    </div>
                    <div className="bg-white dark:bg-surface-dark border p-3 rounded-2xl rounded-tl-none shadow-sm space-y-1.5">
                      <div className="flex justify-between items-center gap-4">
                        <span className="font-bold text-xs text-gray-800 dark:text-white">{selectedTicket.userName}</span>
                        <span className="text-[9px] text-gray-400">Creator</span>
                      </div>
                      <p className="text-xs text-gray-650 dark:text-gray-300 leading-relaxed break-words whitespace-pre-wrap">{selectedTicket.description}</p>
                    </div>
                  </div>

                  {/* Reply list thread */}
                  {(selectedTicket.replies || []).map((reply, i) => {
                    const isAdmin = reply.senderRole === 'admin';
                    const isSelf = reply.senderId === user.uid;
                    return (
                      <div key={i} className={`flex gap-3 items-start max-w-[85%] ${isSelf ? 'ml-auto flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isAdmin ? 'bg-red-500 text-white' : 'bg-primary-light/10 text-primary-light'
                        }`}>
                          {isAdmin ? 'A' : reply.senderName.charAt(0)}
                        </div>
                        <div className={`border p-3 rounded-2xl shadow-sm space-y-1.5 ${
                          isSelf 
                            ? 'bg-primary-light border-primary-light/20 text-white rounded-tr-none' 
                            : 'bg-white dark:bg-surface-dark rounded-tl-none'
                        }`}>
                          <div className="flex justify-between items-center gap-4">
                            <span className={`font-bold text-xs ${isSelf ? 'text-white' : 'text-gray-800'}`}>{reply.senderName}</span>
                            <span className={`text-[9px] font-bold ${isSelf ? 'text-blue-100' : isAdmin ? 'text-red-500' : 'text-gray-400'}`}>
                              {isAdmin ? 'Support Team' : reply.senderRole}
                            </span>
                          </div>
                          <p className={`text-xs leading-relaxed break-words whitespace-pre-wrap ${isSelf ? 'text-blue-50' : 'text-gray-650 dark:text-gray-300'}`}>{reply.message}</p>
                          <span className={`text-[8px] block text-right mt-1 ${isSelf ? 'text-blue-200' : 'text-gray-400'}`}>
                            {reply.createdAt ? new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Footer Form */}
                <div className="p-3 border-t bg-white dark:bg-surface-dark rounded-b-card">
                  {selectedTicket.status === 'closed' ? (
                    <div className="text-center p-2 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg text-xs font-semibold">
                      🔒 This ticket is closed. If you still need help, please raise a new complaint.
                    </div>
                  ) : (
                    <form onSubmit={handleSendReply} className="flex gap-2">
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Type your message to support..."
                        rows={1}
                        className="flex-1 px-4 py-2 text-xs border rounded-xl outline-none focus:border-primary-light dark:bg-gray-850 dark:border-gray-800 text-gray-900 dark:text-white resize-none"
                      />
                      <button
                        type="submit"
                        disabled={replyLoading || !replyText.trim()}
                        className="p-2.5 bg-primary-light text-white rounded-xl shadow-soft flex items-center justify-center shrink-0 hover:bg-primary-light/95 disabled:opacity-50"
                      >
                        {replyLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            /* Ticket Dashboard List View */
            <motion.div
              key="ticket-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {loading ? (
                <div className="py-20 flex justify-center">
                  <Loader2 className="animate-spin text-primary-light" size={32} />
                </div>
              ) : tickets.length === 0 ? (
                <div className="bg-white dark:bg-surface-dark border rounded-card p-12 text-center shadow-soft">
                  <HelpCircle size={48} className="text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                  <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1">No support tickets found</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6 leading-relaxed">
                    Have an issue with a job, customer, worker, or payment? Raise a ticket and our support team will coordinate with you.
                  </p>
                  <button
                    onClick={() => setShowRaiseForm(true)}
                    className="px-5 py-2 bg-primary-light text-white rounded-button font-bold text-xs"
                  >
                    Raise Your First Complaint
                  </button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {tickets.map(ticket => (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className="bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-850 hover:border-primary-light/40 dark:hover:border-primary-dark/40 rounded-card p-4 shadow-soft cursor-pointer transition flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[9px] text-gray-405 font-mono font-bold select-all">#{ticket.id}</span>
                          <span className="text-[10px] text-primary-light font-bold capitalize bg-blue-50 dark:bg-blue-900/10 px-2 py-0.5 rounded">{ticket.category}</span>
                          <Badge variant={
                            ticket.status === 'resolved' || ticket.status === 'completed' ? 'success' :
                            ticket.status === 'in_progress' ? 'primary' :
                            ticket.status === 'closed' ? 'danger' : 'warning'
                          } className="capitalize py-0 text-[9px] font-bold">
                            {ticket.status}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-sm text-gray-950 dark:text-white truncate">{ticket.subject}</h3>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{ticket.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-[10px] text-gray-400">{ticket.createdAt ? new Date(ticket.createdAt.seconds * 1000).toLocaleDateString() : 'recent'}</span>
                        {ticket.replies && ticket.replies.length > 0 && (
                          <span className="text-[9px] bg-red-500 text-white font-bold rounded-full w-5.5 h-5.5 flex items-center justify-center shadow-soft">
                            {ticket.replies.length}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SupportPage;
