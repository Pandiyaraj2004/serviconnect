/**
 * ServiConnect — Real Notification System
 * Writes to top-level collection: notifications/{notifId} with recipientId field
 */
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Create an in-app notification for a user
 * @param {string} userId - UID of the user to notify (recipientId)
 * @param {object} payload - Notification data
 */
export const createNotification = async (userId, payload) => {
  if (!db || !userId) return null;
  try {
    const ref = await addDoc(collection(db, 'notifications'), {
      recipientId: userId,
      type: payload.type || 'info',         // 'booking', 'message', 'review', 'system'
      title: payload.title || 'Notification',
      message: payload.message || '',
      bookingId: payload.bookingId || null,
      link: payload.link || null,
      read: false,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    console.warn('createNotification failed:', err.message);
    return null;
  }
};

/**
 * Mark a single notification as read
 */
export const markNotificationRead = async (userId, notifId) => {
  if (!db || !notifId) return;
  try {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  } catch (err) {
    console.warn('markNotificationRead failed:', err.message);
  }
};

/**
 * Delete a single notification
 */
export const deleteNotification = async (userId, notifId) => {
  if (!db || !notifId) return;
  try {
    await deleteDoc(doc(db, 'notifications', notifId));
  } catch (err) {
    console.warn('deleteNotification failed:', err.message);
  }
};

/**
 * Clear (delete) ALL notifications for a user
 */
export const clearAllNotifications = async (userId, items) => {
  if (!db || !items?.length) return;
  try {
    const batch = writeBatch(db);
    items.forEach(item => {
      const ref = doc(db, 'notifications', item.id);
      batch.delete(ref);
    });
    await batch.commit();
  } catch (err) {
    console.warn('clearAllNotifications failed:', err.message);
  }
};

/**
 * Mark ALL notifications as read for a user
 */
export const markAllNotificationsRead = async (userId, items) => {
  if (!db || !items?.length) return;
  try {
    const batch = writeBatch(db);
    items.forEach(item => {
      if (!item.read) {
        const ref = doc(db, 'notifications', item.id);
        batch.update(ref, { read: true });
      }
    });
    await batch.commit();
  } catch (err) {
    console.warn('markAllNotificationsRead failed:', err.message);
  }
};

/**
 * Subscribe to real-time notifications for a user (sorted client-side)
 * @returns unsubscribe function
 */
export const subscribeToNotifications = (userId, callback) => {
  if (!db || !userId) return () => {};
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Client-side sort by createdAt descending
    items.sort((a, b) => {
      const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });
    callback(items);
  }, (err) => {
    console.warn('subscribeToNotifications error:', err.message);
    callback([]);
  });
};

// Notification templates
export const NOTIF_TEMPLATES = {
  newBooking: (customerName, category, bookingId) => ({
    type: 'booking',
    title: '📋 New Booking Request',
    message: `${customerName} wants to book you for ${category}. Tap to view and respond.`,
    bookingId,
    link: '/worker-dashboard',
  }),
  bookingAccepted: (workerName, category, bookingId) => ({
    type: 'booking',
    title: '✅ Booking Accepted!',
    message: `${workerName} accepted your ${category} booking. Contact details are now visible.`,
    bookingId,
    link: '/bookings',
  }),
  bookingRejected: (workerName, category, bookingId) => ({
    type: 'booking',
    title: '❌ Booking Declined',
    message: `${workerName} is unavailable for your ${category} request. Try another worker.`,
    bookingId,
    link: '/search',
  }),
  newMessage: (senderName, senderId) => ({
    type: 'message',
    title: '💬 New Message',
    message: `${senderName} sent you a message.`,
    link: `/chat/${senderId}`,
  }),
  jobOtp: (workerName, category, otp) => ({
    type: 'booking',
    title: '🔑 Job Completion OTP',
    message: `${workerName} has generated OTP code ${otp} for your ${category} service. Share this code with the worker to confirm completion.`,
    link: '/bookings',
  }),
  jobCompleted: (workerName, category) => ({
    type: 'system',
    title: '🎉 Job Completed',
    message: `${workerName} marked the ${category} job as complete. Please submit your OTP to confirm.`,
    bookingId: null,
    link: '/bookings',
  }),
};
