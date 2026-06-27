import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Badge, EmptyState, BottomNav } from '../components/UI';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { subscribeToNotifications } from '../utils/notifications';

const MyBookings = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [tab, setTab] = useState('upcoming');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToNotifications(user.uid, (items) => {
      setUnreadCount(items.filter(i => !i.read).length);
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('customerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
      const list = snapshot.docs.map((bookingDoc) => ({ id: bookingDoc.id, ...bookingDoc.data() }));
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setBookings(list);
      setLoading(false);
    }, (error) => {
      console.error('Booking fetch failed:', error);
      toast.error('Could not load bookings');
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const visibleBookings = bookings.filter((booking) => {
    const status = (booking.status || '').toLowerCase();
    return tab === 'upcoming'
      ? !['completed', 'cancelled'].includes(status)
      : ['completed', 'cancelled'].includes(status);
  });

  const cancelBooking = async (booking) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });

      // Mark worker as Available again when booking is cancelled
      if (booking.workerId) {
        await updateDoc(doc(db, 'workers', booking.workerId), {
          available: true,
          updatedAt: serverTimestamp()
        });
      }

      toast.success('Booking cancelled');
    } catch (error) {
      toast.error(error.message || 'Could not cancel booking');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      <div className="sticky top-16 z-40 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">My Bookings</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Your trips & jobs</h1>
          </div>
          <button onClick={() => navigate('/search')} className="text-sm text-primary-light dark:text-primary-dark font-semibold">Book again</button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {['upcoming', 'past'].map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === value ? 'bg-primary-light text-white' : 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300'}`}
            >
              {value === 'upcoming' ? 'Upcoming' : 'Past'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-white dark:bg-surface-dark rounded-card border border-gray-100 dark:border-gray-800 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : visibleBookings.length === 0 ? (
          <EmptyState
            title="No bookings yet"
            description="Your confirmed jobs and past work history will appear here. Book a worker to get started."
            illustration="📋"
            action={<button onClick={() => navigate('/search')} className="px-6 py-3 bg-primary-light dark:bg-primary-dark text-white rounded-button font-semibold">Browse workers</button>}
          />
        ) : (
          <div className="space-y-4">
            {visibleBookings.map((item) => (
              <div key={item.id} className="bg-white dark:bg-surface-dark rounded-card border border-gray-100 dark:border-gray-800 p-5 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400 font-mono truncate">#{item.id}</div>
                    <h2 className="font-bold text-lg text-gray-900 dark:text-white">{item.workerName || 'Assigned worker'}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.category || 'Service'} — {item.address || 'Address unavailable'}</p>
                  </div>
                  <Badge variant={
                    item.status === 'completed' ? 'success' :
                    item.status === 'confirmed' ? 'primary' :
                    item.status === 'cancelled' ? 'default' : 'warning'
                  }>
                    {item.status || 'pending'}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <Clock size={14} />
                    {item.date}, {item.timeSlot}
                  </div>
                  <div>{item.rating ? `⭐ ${item.rating}` : 'No review yet'}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate(`/chat/${item.workerId || item.id}`)}
                    className="text-sm px-4 py-2 bg-gray-100 dark:bg-gray-900 rounded-button text-gray-700 dark:text-gray-300"
                  >
                    Chat
                  </button>
                  {item.status === 'completed' ? (
                    <button
                      onClick={() => navigate(`/review/${item.id}`)}
                      className="text-sm px-4 py-2 bg-primary-light dark:bg-primary-dark text-white rounded-button"
                    >
                      Leave Review
                    </button>
                  ) : item.status !== 'cancelled' && (
                    <button
                      onClick={() => cancelBooking(item)}
                      className="text-sm px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-button"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav active="bookings" onNavigate={navigate} unreadNotifications={unreadCount} userRole={userProfile?.role} />
    </div>
  );
};

export default MyBookings;
