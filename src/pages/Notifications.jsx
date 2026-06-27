import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, MessageCircle, CheckCircle2, Sparkles, AlertTriangle, Loader2, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeToNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, clearAllNotifications } from '../utils/notifications';
import { BottomNav } from '../components/UI';
import { timeAgo } from '../utils/helpers';

const TYPE_CONFIG = {
  booking: { icon: <CheckCircle2 size={18} />, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  message: { icon: <MessageCircle size={18} />, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950/30' },
  review:  { icon: <Sparkles size={18} />, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  system:  { icon: <AlertTriangle size={18} />, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  info:    { icon: <Bell size={18} />, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800' },
};

const FILTER_TYPES = ['All', 'booking', 'message', 'review', 'system'];

const Notifications = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToNotifications(user.uid, (notifs) => {
      setItems(notifs);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleClick = async (item) => {
    if (!item.read) {
      await markNotificationRead(user.uid, item.id);
    }
    if (item.link) navigate(item.link);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(user.uid, items);
  };

  const handleDelete = async (notifId) => {
    await deleteNotification(user.uid, notifId);
  };

  const handleClearAll = async () => {
    setShowClearConfirm(false);
    await clearAllNotifications(user.uid, items);
  };

  const filtered = filter === 'All' ? items : items.filter(i => i.type === filter);
  const unreadCount = items.filter(i => !i.read).length;

  const getTimestamp = (item) => {
    if (!item.createdAt) return '';
    const date = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
    return timeAgo(date);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-24">
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Activity Center</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="px-2.5 py-1 text-xs font-bold bg-primary-light text-white rounded-full">
                {unreadCount} new
              </span>
            )}
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary-light dark:text-primary-dark font-semibold flex items-center gap-1 hover:opacity-85 transition-opacity"
              >
                <Check size={14} /> Mark all read
              </button>
            )}
            {items.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-xs text-red-500 font-semibold flex items-center gap-1 hover:opacity-85 transition-opacity"
              >
                <Trash2 size={14} /> Clear all
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-1">
          {FILTER_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                filter === type
                  ? 'bg-primary-light dark:bg-primary-dark text-white'
                  : 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300'
              }`}
            >
              {type === 'All' ? '🔔 All' :
               type === 'booking' ? '📋 Bookings' :
               type === 'message' ? '💬 Messages' :
               type === 'review' ? '⭐ Reviews' : '⚙️ System'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-3">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin text-primary-light" />
            <p className="text-sm text-gray-400">Loading notifications...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="text-5xl mb-4">🔔</div>
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">All caught up!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filter === 'All'
                ? 'No notifications yet. Book a service to get started.'
                : `No ${filter} notifications.`}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((item, i) => {
              const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => handleClick(item)}
                  className={`relative bg-white dark:bg-gray-900 rounded-2xl border p-4 shadow-sm cursor-pointer flex gap-4 items-start transition-all hover:shadow-md ${
                    !item.read
                      ? 'border-primary-light/30 dark:border-primary-dark/30'
                      : 'border-gray-100 dark:border-gray-800'
                  }`}
                >
                  {/* Unread dot */}
                  {!item.read && (
                    <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-primary-light dark:bg-primary-dark" />
                  )}

                  {/* Icon */}
                  <div className={`w-11 h-11 rounded-2xl ${config.bg} ${config.color} flex items-center justify-center flex-shrink-0`}>
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`font-semibold text-sm ${!item.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                          {getTimestamp(item)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          title="Delete Notification"
                          aria-label="Delete Notification"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      {item.message}
                    </p>
                    {item.link && (
                      <span className="text-xs text-primary-light dark:text-primary-dark font-semibold mt-2 inline-block">
                        Tap to view →
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-card w-full max-w-sm p-6 border border-gray-100 dark:border-gray-850 shadow-2xl space-y-4"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center mx-auto text-red-500 dark:text-red-400">
                  <Trash2 size={22} />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">Clear All Notifications?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete all notifications? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-button text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 py-2 bg-red-500 text-white font-bold rounded-button text-sm transition-colors hover:bg-red-600"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BottomNav active="notifications" onNavigate={navigate} unreadNotifications={unreadCount} userRole={userProfile?.role} />
    </div>
  );
};

export default Notifications;
