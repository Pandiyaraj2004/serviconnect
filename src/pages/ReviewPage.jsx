import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const ReviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const handleSubmit = async () => {
    if (!review.trim()) return toast.error('Please write a review');
    if (!user) return toast.error('Please log in to submit a review');

    setLoading(true);
    try {
      if (db && id) {
        await updateDoc(doc(db, 'bookings', id), {
          rating,
          review: review.trim(),
          reviewedAt: serverTimestamp(),
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
      }
      toast.success('Review submitted! Thank you.');
      navigate('/bookings');
    } catch (err) {
      console.error('Review submit error:', err);
      toast.error(err.message || 'Could not submit review');
    } finally {
      setLoading(false);
    }
  };

  const activeRating = hoverRating || rating;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      <div className="sticky top-16 z-40 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900 px-4 py-4">
        <button onClick={() => navigate(-1)} className="text-primary-light dark:text-primary-dark text-sm font-semibold">← Back</button>
      </div>
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="bg-white dark:bg-surface-dark rounded-card p-8 border border-gray-100 dark:border-gray-800 shadow-soft">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Leave a review</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Share your experience for booking #{id}. Your feedback helps future customers and improves worker trust.
          </p>

          {/* Star Rating */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Your Rating</p>
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setRating(index + 1)}
                  onMouseEnter={() => setHoverRating(index + 1)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-3xl transition-transform hover:scale-110"
                >
                  <span className={activeRating > index ? 'text-amber-400' : 'text-gray-300'}>★</span>
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {activeRating === 1 ? 'Poor' : activeRating === 2 ? 'Fair' : activeRating === 3 ? 'Good' : activeRating === 4 ? 'Very Good' : 'Excellent'} — {activeRating} out of 5
            </p>
          </div>

          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={6}
            maxLength={1000}
            placeholder="Describe the quality of work, punctuality, and overall experience..."
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-input bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-primary-light dark:focus:border-primary-dark resize-none"
          />
          <div className="text-right text-xs text-gray-400 mt-1">{review.length}/1000</div>

          <button
            onClick={handleSubmit}
            disabled={loading || !review.trim()}
            className="mt-6 w-full py-3 bg-primary-light dark:bg-primary-dark text-white rounded-button font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? <><Loader2 size={18} className="animate-spin" /> Submitting...</> : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewPage;
