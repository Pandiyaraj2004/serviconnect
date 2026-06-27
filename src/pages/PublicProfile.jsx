import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Phone, MapPin, MessageCircle } from 'lucide-react';
import { Badge } from '../components/UI';

const PUBLIC_WORKER = {
  name: 'Rajesh Kumar', category: 'Plumber', rating: 4.8, jobs: 142, city: 'Mumbai', price: 299,
  trustScore: 8.7, reviews: 78, responseRate: '96%', badge: 'AI Verified', bio: 'Trusted local plumber with 8 years of experience in pipe repair, leak sealing, and bathroom fittings.',
};

const PublicProfile = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      <div className="relative h-72 bg-gradient-to-br from-blue-500 to-purple-600">
        <button onClick={() => navigate(-1)} className="absolute top-14 left-4 p-2 bg-white/20 rounded-full text-white">
          <ArrowLeft size={20} />
        </button>
        <button onClick={() => navigator.clipboard.writeText(window.location.href)} className="absolute top-14 right-4 p-2 bg-white/20 rounded-full text-white">
          <Share2 size={20} />
        </button>
      </div>
      <div className="container mx-auto px-4 -mt-16">
        <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-100 dark:border-gray-800 p-6 shadow-soft">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-light to-blue-400 flex items-center justify-center text-white text-3xl font-black">RK</div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">{PUBLIC_WORKER.name}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{PUBLIC_WORKER.category} • {PUBLIC_WORKER.city}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="ai">🤖 {PUBLIC_WORKER.badge}</Badge>
                  <Badge variant="success">{PUBLIC_WORKER.responseRate} response</Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => window.open(`https://wa.me/91${'9876543210'}`, '_blank')} className="px-5 py-3 bg-primary-light dark:bg-primary-dark text-white rounded-button text-sm font-semibold">Chat on WhatsApp</button>
              <button onClick={() => navigate('/book/1')} className="px-5 py-3 border border-gray-200 dark:border-gray-700 rounded-button text-sm font-semibold">Book Now</button>
            </div>
          </div>

          <div className="grid gap-4 mt-8 md:grid-cols-3">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-card">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-2">Rating</p>
              <div className="text-3xl font-black text-gray-900 dark:text-white">{PUBLIC_WORKER.rating}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{PUBLIC_WORKER.reviews} reviews</div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-card">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-2">Jobs</p>
              <div className="text-3xl font-black text-gray-900 dark:text-white">{PUBLIC_WORKER.jobs}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Completed jobs</div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-card">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-2">Price</p>
              <div className="text-3xl font-black text-gray-900 dark:text-white">₹{PUBLIC_WORKER.price}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Starting rate</div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="bg-white dark:bg-black rounded-card border border-gray-100 dark:border-gray-800 p-6">
              <h2 className="font-bold text-lg mb-3">About the worker</h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{PUBLIC_WORKER.bio}</p>
            </div>
            <div className="bg-white dark:bg-black rounded-card border border-gray-100 dark:border-gray-800 p-6">
              <h2 className="font-bold text-lg mb-3">Contact</h2>
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <div className="flex items-center gap-2"><Phone size={16} /> +91 98765 43210</div>
                <div className="flex items-center gap-2"><MapPin size={16} /> {PUBLIC_WORKER.city}</div>
                <div className="flex items-center gap-2"><MessageCircle size={16} /> Available via WhatsApp instantly.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
