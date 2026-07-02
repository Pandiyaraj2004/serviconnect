import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { sendJobCompletionOTP } from '../utils/helpers';
import { doc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { createNotification, NOTIF_TEMPLATES } from '../utils/notifications';

const OTPBox = ({ values, onChange, onKeyDown }) => (
  <div className="flex gap-3 justify-center">
    {values.map((val, i) => (
      <input
        key={i}
        id={`otp-${i}`}
        type="text"
        maxLength={1}
        value={val}
        onChange={e => onChange(i, e.target.value)}
        onKeyDown={e => onKeyDown(i, e)}
        className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-card outline-none transition-all focus:border-primary-light dark:focus:border-primary-dark bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
      />
    ))}
  </div>
);

const JobCompletionPage = () => {
  const { id: bookingId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);

  // Real-time listener for the booking document to react immediately when status changes
  useEffect(() => {
    if (!db || !bookingId) return;

    const bookingRef = doc(db, 'bookings', bookingId);
    const unsubscribe = onSnapshot(bookingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBooking({ id: docSnap.id, ...data });
        if (data.otp) {
          setOtpSent(true);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching booking details:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [bookingId]);

  // If customer watches the booking turn to 'completed', redirect to reviews!
  useEffect(() => {
    if (booking && userProfile && userProfile.role === 'customer' && booking.status === 'completed') {
      toast.success('Job marked completed by worker! Redirecting to reviews...');
      const delay = setTimeout(() => {
        navigate(`/review/${booking.id}`);
      }, 2000);
      return () => clearTimeout(delay);
    }
  }, [booking, userProfile, navigate]);

  const handleOtpChange = (i, val) => {
    if (val !== '' && !/^[0-9]$/.test(val)) return;
    setOtpDigits(prev => {
      const n = [...prev];
      n[i] = val;
      return n;
    });
    if (val && i < 3) {
      document.getElementById(`otp-${i + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) {
      setOtpDigits(prev => { 
        const n = [...prev]; 
        n[i - 1] = ''; 
        return n; 
      });
      document.getElementById(`otp-${i - 1}`)?.focus();
    }
  };

  // Generate and send OTP (Worker action)
  const handleInitiateCompletion = async () => {
    if (!booking || !db) return;
    setActionLoading(true);
    
    // Generate random 4-digit code
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        otp: generatedOtp,
        updatedAt: serverTimestamp()
      });
      
      // 1. Send in-app website notification with OTP
      await createNotification(
        booking.customerId,
        NOTIF_TEMPLATES.jobOtp(booking.workerName, booking.category, generatedOtp)
      );

      // 2. Trigger WhatsApp API message notification
      if (booking.customerPhone) {
        sendJobCompletionOTP(booking.customerPhone, {
          customerName: booking.customerName,
          workerName: booking.workerName,
          otp: generatedOtp
        });
        toast.success('OTP sent to customer via WhatsApp and in-app!');
      } else {
        toast.success('OTP sent to customer via in-app website notification!');
      }
      
      setOtpSent(true);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to generate OTP code: ${err.message || err.toString()}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Verify OTP code (Worker action)
  const handleVerifyOtp = async () => {
    const entered = otpDigits.join('');
    if (entered.length < 4) {
      toast.error('Please enter the full 4-digit OTP code');
      return;
    }

    if (entered !== booking.otp) {
      toast.error('Invalid OTP code. Please confirm with the customer.');
      return;
    }

    setActionLoading(true);
    try {
      // 1. Update Booking status to completed
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Set worker back to available in workers collection
      await updateDoc(doc(db, 'workers', booking.workerId), {
        available: true,
        activeBookingId: null,
        updatedAt: serverTimestamp()
      });

      toast.success('OTP verified successfully! Job completed.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to complete job transaction');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
        <Loader2 className="animate-spin text-primary-light" size={40} />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-black p-4 text-center">
        <AlertCircle className="text-red-500 mb-2" size={40} />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Booking not found</h2>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-primary-light text-white rounded-button">Go Back</button>
      </div>
    );
  }

  const isWorker = userProfile?.role === 'worker';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900 px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-gray-900 dark:text-white">Job OTP Verification</h1>
        </div>
      </div>

      <div className="px-4 py-8 max-w-md mx-auto">
        <div className="bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-card p-5 mb-6 shadow-soft">
          <span className="text-[10px] text-gray-400 font-mono">BOOKING ID: #{booking.id}</span>
          <h3 className="font-bold text-gray-900 dark:text-white text-base mt-1">
            {isWorker ? `Customer: ${booking.customerName}` : `Worker: ${booking.workerName}`}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">{booking.category} service</p>
          <div className="border-t border-gray-100 dark:border-gray-800 mt-3 pt-3 text-xs space-y-1.5 text-gray-600 dark:text-gray-400">
            <p>📍 <strong>Address:</strong> {booking.address}</p>
            <p>📝 <strong>Problem:</strong> "{booking.problemDescription}"</p>
            <p>💵 <strong>Amount Due:</strong> ₹{booking.price}</p>
          </div>
        </div>

        {/* WORKER FLOW */}
        {isWorker && (
          <AnimatePresence mode="wait">
            {booking.status === 'completed' ? (
              <motion.div key="completed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
                <CheckCircle className="text-green-500 w-16 h-16 mx-auto mb-4" />
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Work Completed!</h2>
                <p className="text-sm text-gray-500 mb-8">This job has been marked as complete. Your status is set to Available.</p>
                <button onClick={() => navigate('/worker-dashboard')} className="w-full py-3 bg-primary-light dark:bg-primary-dark text-white font-bold rounded-button">
                  Worker Dashboard
                </button>
              </motion.div>
            ) : !otpSent ? (
              <motion.div key="initiate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-xl text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                  Clicking confirm will send a unique 4-digit OTP to the customer via WhatsApp.
                  Ask the customer for the OTP code once they are satisfied with the work.
                </div>
                <button
                  onClick={handleInitiateCompletion}
                  disabled={actionLoading}
                  className="w-full py-3 bg-green-500 text-white rounded-button font-bold flex items-center justify-center gap-2 disabled:opacity-75 shadow"
                >
                  {actionLoading ? <Loader2 className="animate-spin" size={18} /> : null}
                  Confirm & Send OTP Code
                </button>
              </motion.div>
            ) : (
              <motion.div key="otp-entry" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Enter Verification OTP</h2>
                  <p className="text-xs text-gray-500">Ask the customer to share the 4-digit code sent to their WhatsApp.</p>
                </div>
                
                <OTPBox values={otpDigits} onChange={handleOtpChange} onKeyDown={handleOtpKeyDown} />
                
                <div className="flex gap-2">
                  <button
                    onClick={() => { setOtpDigits(['', '', '', '']); setOtpSent(false); }}
                    className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-button text-xs font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Resend Code
                  </button>
                  <button
                    onClick={handleVerifyOtp}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-green-500 text-white rounded-button font-bold text-xs flex items-center justify-center gap-1 shadow disabled:opacity-75"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={14} /> : null}
                    Verify & Complete
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* CUSTOMER FLOW */}
        {!isWorker && (
          <AnimatePresence mode="wait">
            {booking.status === 'completed' ? (
              <motion.div key="customer-completed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
                <CheckCircle className="text-green-500 w-16 h-16 mx-auto mb-4" />
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Job Confirmed!</h2>
                <p className="text-sm text-gray-500">Redirecting to leave a review...</p>
              </motion.div>
            ) : !otpSent ? (
              <motion.div key="customer-wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6 space-y-2">
                <Loader2 className="animate-spin text-primary-light mx-auto" size={36} />
                <h3 className="font-bold text-gray-900 dark:text-white">Waiting for Worker</h3>
                <p className="text-xs text-gray-500">The worker will trigger the job completion on their end when they finish.</p>
              </motion.div>
            ) : (
              <motion.div key="customer-otp-display" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <ShieldCheck size={32} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Your Job Completion OTP</h2>
                  <p className="text-xs text-gray-500 leading-relaxed px-4">
                    Share this code with the worker only if you are completely satisfied with their services.
                  </p>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl py-5 text-4xl font-black tracking-widest text-primary-light text-center border font-mono">
                  {booking.otp}
                </div>
                
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl text-left text-xs text-amber-700 dark:text-amber-400">
                  <p className="font-bold">⚠️ Warning:</p>
                  <p className="mt-0.5 leading-normal">
                    Do not share this OTP code if the work is incomplete or has issues. You can report grievances in My Bookings or discuss with the worker.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default JobCompletionPage;
