import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Send, Image, Loader2, Calendar } from 'lucide-react';
import { ref, push, onValue, serverTimestamp } from 'firebase/database';
import { rtdb, isRealtimeDatabaseConfigured, db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { createNotification, NOTIF_TEMPLATES } from '../utils/notifications';
import { formatImageUrl } from '../utils/helpers';

const ChatPage = () => {
  const navigate = useNavigate();
  const { id: otherParticipantId } = useParams(); // can be workerId or customerId
  const { user, userProfile } = useAuth();
  
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [loadingPartner, setLoadingPartner] = useState(true);
  const [hasConfirmedBooking, setHasConfirmedBooking] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);

  // Compute unified roomId: customerUid_workerUid
  const { customerId, workerId, roomId } = useMemo(() => {
    if (!user || !userProfile || !otherParticipantId) return {};
    
    let cId = '';
    let wId = '';
    
    if (userProfile.role === 'worker') {
      cId = otherParticipantId;
      wId = user.uid;
    } else {
      cId = user.uid;
      wId = otherParticipantId;
    }
    
    return {
      customerId: cId,
      workerId: wId,
      roomId: `${cId}_${wId}`
    };
  }, [user, userProfile, otherParticipantId]);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  // 1. Fetch other participant's profile and check booking status
  useEffect(() => {
    const fetchPartnerAndBooking = async () => {
      if (!db || !otherParticipantId || !userProfile || !customerId || !workerId) return;
      
      setLoadingPartner(true);
      try {
        // Fetch profile
        if (userProfile.role === 'worker') {
          // I am worker, partner is customer
          const customerSnap = await getDoc(doc(db, 'users', otherParticipantId));
          if (customerSnap.exists()) {
            setPartnerProfile({
              name: customerSnap.data().name || 'Customer',
              phone: customerSnap.data().phone || '',
              avatar: customerSnap.data().avatar || '',
              initial: (customerSnap.data().name || 'C').charAt(0),
              role: 'Customer'
            });
          }
        } else {
          // I am customer, partner is worker
          const workerSnap = await getDoc(doc(db, 'workers', otherParticipantId));
          if (workerSnap.exists()) {
            setPartnerProfile({
              name: workerSnap.data().name || 'Worker',
              phone: workerSnap.data().phone || '',
              avatar: workerSnap.data().avatar || '',
              initial: (workerSnap.data().name || 'W').charAt(0),
              role: workerSnap.data().category || 'Worker'
            });
          }
        }

        // Check if there is an active/completed booking between these two
        const bookingsRef = collection(db, 'bookings');
        const q = query(
          bookingsRef, 
          where('customerId', '==', customerId),
          where('workerId', '==', workerId)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Allowed statuses to share contact number: confirmed, completed
        const active = list.find(b => b.status === 'confirmed' || b.status === 'completed');
        if (active) {
          setHasConfirmedBooking(true);
          setBookingDetails(active);
        }
      } catch (err) {
        console.error('Error fetching chat context:', err);
      } finally {
        setLoadingPartner(false);
      }
    };
    fetchPartnerAndBooking();
  }, [otherParticipantId, userProfile, customerId, workerId]);

  // 2. Real-time RTDB listener for chat messages
  useEffect(() => {
    if (!user || !roomId) return;

    if (!isRealtimeDatabaseConfigured) {
      setMessages([
        { id: '1', text: 'Hi! Let\'s coordinate here.', sender: 'system', timestamp: Date.now() }
      ]);
      return;
    }

    const chatRef = ref(rtdb, `chats/${roomId}/messages`);
    const unsubscribe = onValue(chatRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const msgs = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value,
          timestamp: typeof value.timestamp === 'number' ? value.timestamp : Date.now(),
        }));
        setMessages(msgs.sort((a, b) => a.timestamp - b.timestamp));
      } else {
        setMessages([]);
      }
    }, (error) => {
      console.error('Chat load error:', error);
    });

    return () => unsubscribe();
  }, [user, roomId]);

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText('');

    if (!isRealtimeDatabaseConfigured) {
      const newMsg = {
        id: Date.now().toString(),
        text,
        sender: user.uid,
        senderRole: userProfile?.role || 'customer',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, newMsg]);
      return;
    }

    setSending(true);
    try {
      const chatRef = ref(rtdb, `chats/${roomId}/messages`);
      await push(chatRef, {
        text,
        sender: user.uid,
        senderRole: userProfile?.role || 'customer',
        createdBy: user.uid,
        timestamp: serverTimestamp(),
      });

      // Send in-app notification to message recipient
      if (otherParticipantId) {
        await createNotification(
          otherParticipantId,
          NOTIF_TEMPLATES.newMessage(userProfile?.name || 'Someone', user.uid)
        );
      }
    } catch (error) {
      toast.error('Message could not be sent.');
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loadingPartner) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
        <Loader2 className="animate-spin text-primary-light" size={40} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50 dark:bg-black">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-surface-dark border-b border-gray-100 dark:border-gray-800 shrink-0 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="relative">
          {partnerProfile?.avatar ? (
            <img src={formatImageUrl(partnerProfile.avatar)} alt={partnerProfile.name} className="w-10 h-10 rounded-full object-cover border" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-light to-blue-400 flex items-center justify-center text-white font-bold text-sm">
              {partnerProfile?.initial || 'U'}
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="font-bold text-gray-900 dark:text-white text-sm">{partnerProfile?.name || 'User'}</div>
          <div className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">{partnerProfile?.role}</div>
        </div>

        {/* Contact info: display phone number only if verified booking exists */}
        {hasConfirmedBooking && partnerProfile?.phone ? (
          <a href={`tel:+91${partnerProfile.phone}`} className="p-2.5 bg-green-500 text-white rounded-full flex items-center justify-center shadow hover:scale-105 transition-transform" title="Call">
            <Phone size={16} />
          </a>
        ) : (
          <button onClick={() => toast.error('Phone details are locked until booking request is Accepted')} className="p-2.5 bg-gray-200 text-gray-400 rounded-full shrink-0" title="Locked">
            <Phone size={16} />
          </button>
        )}
      </div>

      {/* Booking Pinned Status Warning */}
      {!hasConfirmedBooking && (
        <div className="mx-4 mt-3 shrink-0">
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-card px-4 py-3 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
            <div>
              <p className="font-bold">🔒 Contact Details Hidden</p>
              <p>Mobile phone numbers will be shared once the worker accepts the booking request.</p>
            </div>
            {userProfile?.role === 'customer' && (
              <button
                onClick={() => navigate(`/book/${workerId}`)}
                className="px-3 py-1.5 bg-amber-500 text-white rounded font-bold shrink-0 shadow-sm"
              >
                Book Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contact revealed banner — shown after booking accepted */}
      {hasConfirmedBooking && partnerProfile?.phone && (
        <div className="mx-4 mt-3 shrink-0">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-green-700 dark:text-green-400">📞 Contact Unlocked</p>
              <p className="text-green-600 dark:text-green-500 font-mono text-sm font-bold mt-0.5">+91 {partnerProfile.phone}</p>
            </div>
            <a
              href={`tel:+91${partnerProfile.phone}`}
              className="px-3 py-1.5 bg-green-500 text-white rounded-lg font-bold shadow-sm"
            >
              Call Now
            </a>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-xs text-gray-450 dark:text-gray-555 py-20 select-none">
            No messages yet. Send a message to start coordinating!
          </div>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.sender === user?.uid;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {!isOwn && (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] mr-2 mt-1 flex-shrink-0 font-bold border">
                    {partnerProfile?.avatar ? (
                      <img src={formatImageUrl(partnerProfile.avatar)} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      partnerProfile?.initial
                    )}
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isOwn
                    ? 'bg-primary-light dark:bg-primary-dark text-white rounded-br-sm shadow-soft'
                    : 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white border border-gray-150 dark:border-gray-850 rounded-bl-sm shadow-soft'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                  <p className={`text-[9px] mt-1 text-right ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="px-4 pb-6 pt-3 bg-white dark:bg-black border-t border-gray-100 dark:border-gray-900 flex items-center gap-3 shrink-0">
        <div className="flex-1 flex items-center bg-gray-100 dark:bg-gray-900 rounded-full px-4 py-2.5">
          <input
            type="text"
            placeholder="Type a message..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 outline-none placeholder-gray-450 font-medium"
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={sendMessage}
          disabled={sending || !inputText.trim()}
          className="w-10 h-10 bg-primary-light dark:bg-primary-dark text-white rounded-full flex items-center justify-center disabled:opacity-50 shadow-md shrink-0"
        >
          <Send size={16} />
        </motion.button>
      </div>
    </div>
  );
};

export default ChatPage;
