import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Sparkles, Clock3 } from 'lucide-react';
import { SERVICE_CATEGORIES } from '../utils/helpers';

const AboutPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white pb-20">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/5" />
        <div className="relative container mx-auto px-6 pt-28 pb-16">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.3em] text-primary-light dark:text-primary-dark mb-4">About ServiConnect</p>
            <h1 className="text-4xl sm:text-5xl font-black mb-5">AI-powered local worker booking made effortless.</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
              ServiConnect connects you with verified plumbers, electricians, carpenters and local specialists in minutes. We combine Gemini AI trust scoring, free WhatsApp notifications, and OpenStreetMap location tools for a premium experience without any hidden fees.
            </p>
            <button onClick={() => navigate('/search')} className="inline-flex items-center gap-2 px-6 py-3 bg-primary-light dark:bg-primary-dark text-white rounded-button font-semibold hover:scale-[1.02] transition-transform">
              Explore Services <ArrowRight size={18} />
            </button>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              { icon: <ShieldCheck size={24} />, title: 'AI Verified', description: 'Every worker gets an AI trust score and review summary.' },
              { icon: <Sparkles size={24} />, title: 'Premium UX', description: 'Smooth booking, responsive design and modern interactions.' },
              { icon: <Clock3 size={24} />, title: 'Instant Booking', description: 'WhatsApp alerts and real-time booking in under 2 minutes.' },
            ].map((card, idx) => (
              <div key={idx} className="bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-card p-6 shadow-soft">
                <div className="w-12 h-12 rounded-2xl bg-primary-light/10 dark:bg-primary-dark/15 text-primary-light dark:text-primary-dark flex items-center justify-center mb-4">
                  {card.icon}
                </div>
                <h2 className="font-bold text-lg mb-2">{card.title}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-16">
            <h2 className="text-2xl font-bold mb-6">Popular Services</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {SERVICE_CATEGORIES.slice(0, 6).map((cat) => (
                <div key={cat.id} className="bg-white dark:bg-surface-dark rounded-card p-4 border border-gray-100 dark:border-gray-800 text-center">
                  <div className="text-3xl mb-3">{cat.icon}</div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{cat.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
