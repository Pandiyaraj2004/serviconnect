import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, CheckCircle, X } from 'lucide-react';
import { SERVICE_CATEGORIES } from '../utils/helpers';

const headlines = ["Find trusted Plumbers", "Find trusted Electricians", "Find trusted Carpenters", "Find trusted Painters", "Find trusted Cleaners"];

const testimonials = [
  { name: "Priya Sharma", city: "Mumbai", rating: 5, text: "Found a great plumber in 5 minutes! The AI verification gave me confidence. Excellent service.", avatar: "PS" },
  { name: "Rahul Gupta", city: "Delhi", rating: 5, text: "ServiConnect saved me hours of searching. The worker was punctual and professional.", avatar: "RG" },
  { name: "Anita Verma", city: "Bangalore", rating: 5, text: "Amazing app! Booked an electrician at 9 PM and he arrived by 10 PM. Just incredible.", avatar: "AV" },
  { name: "Mohammed Ali", city: "Hyderabad", rating: 4, text: "Very smooth experience. The AI badge is genius — I knew exactly who to trust.", avatar: "MA" },
  { name: "Sunita Patel", city: "Pune", rating: 5, text: "Rebooked the same carpenter 3 times now. Quality workers, fair prices. Love ServiConnect.", avatar: "SP" },
];

const CountUp = ({ target, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (inView) {
      let start = 0;
      const duration = 2000;
      const step = target / (duration / 16);
      const timer = setInterval(() => {
        start += step;
        if (start >= target) { setCount(target); clearInterval(timer); }
        else setCount(Math.floor(start));
      }, 16);
      return () => clearInterval(timer);
    }
  }, [inView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [particles] = useState(() => Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 6 + 2,
    duration: Math.random() * 10 + 10,
  })));

  useEffect(() => {
    const timer = setInterval(() => {
      setHeadlineIndex(prev => (prev + 1) % headlines.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-black overflow-x-hidden">
      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-4">
        {/* Animated gradient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/3 -right-20 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-20 left-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          {/* Particles */}
          {particles.map(p => (
            <motion.div
              key={p.id}
              className="absolute rounded-full bg-primary-light/30 dark:bg-primary-dark/40"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
              animate={{ y: [-20, 20, -20], opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: p.duration, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>

        <div className="container mx-auto max-w-6xl relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <span className="inline-block px-4 py-1.5 mb-8 text-sm font-semibold text-primary-light dark:text-primary-dark bg-blue-50 dark:bg-blue-900/30 rounded-full border border-blue-200 dark:border-blue-700">
              🤖 Powered by ServiConnect AI
            </span>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-6 tracking-tight text-gray-900 dark:text-white leading-tight">
              <AnimatePresence mode="wait">
                <motion.span
                  key={headlineIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-blue-400 dark:from-primary-dark dark:to-blue-300"
                >
                  {headlines[headlineIndex]}
                </motion.span>
              </AnimatePresence>
              <span className="block text-gray-900 dark:text-white mt-2">near you, instantly</span>
            </h1>

            <p className="text-lg sm:text-xl md:text-2xl text-gray-500 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
              AI verified local workers near you. Book in 2 minutes. Pay only when satisfied.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/search')}
                className="px-8 py-4 bg-primary-light dark:bg-primary-dark text-white rounded-button text-lg font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
              >
                Find a Worker <ArrowRight size={20} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/worker-register')}
                className="px-8 py-4 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-button text-lg font-semibold hover:border-primary-light dark:hover:border-primary-dark transition-colors"
              >
                Join as Worker
              </motion.button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-8 md:gap-16">
              {[
                { value: 500, suffix: '+', label: 'Verified Workers' },
                { value: 1200, suffix: '+', label: 'Bookings Done' },
                { value: 4.8, suffix: '★', label: 'Average Rating' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    <CountUp target={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* MARQUEE STRIP */}
      <div className="py-8 bg-gray-50 dark:bg-gray-900/50 border-y border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...SERVICE_CATEGORIES, ...SERVICE_CATEGORIES].map((cat, i) => (
            <div key={i} className="mx-10 flex items-center gap-3 text-gray-500 dark:text-gray-400 font-medium text-sm">
              <span className="text-2xl">{cat.icon}</span>
              <span>{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 px-4 bg-white dark:bg-black">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">How it works</h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Three simple steps to get any job done</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: '🔍', title: 'Find', desc: 'Search by category or problem. AI-powered matching finds the best workers near you instantly.' },
              { step: '02', icon: '🤖', title: 'Verify', desc: 'Every worker passes our Gemini AI skill test and gets an AI Trust Score you can rely on.' },
              { step: '03', icon: '✅', title: 'Book', desc: 'Book in 2 minutes. Worker gets WhatsApp notification instantly. Pay only after satisfaction.' },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ y: -4 }}
                className="p-8 bg-gray-50 dark:bg-surface-dark rounded-card border border-gray-100 dark:border-gray-800 relative"
              >
                <div className="absolute top-6 right-6 text-5xl font-black text-gray-100 dark:text-gray-800">{step.step}</div>
                <div className="text-4xl mb-6">{step.icon}</div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{step.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY SERVICONNECT - COMPARISON */}
      <section className="py-24 px-4 bg-gray-50 dark:bg-gray-900/30">
        <div className="container mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Why ServiConnect?</h2>
            <p className="text-gray-500 dark:text-gray-400">See how we compare to traditional alternatives</p>
          </motion.div>

          <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="grid grid-cols-3 bg-gray-50 dark:bg-gray-800/50 px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-400">
              <span>Feature</span>
              <span className="text-center text-primary-light dark:text-primary-dark font-bold">ServiConnect</span>
              <span className="text-center">Others</span>
            </div>
            {[
              'AI Verified Workers', 'Real-Time WhatsApp Alerts', 'Free to Use', 
              'Instant Booking', 'OTP Job Completion', 'Trust Score System',
              'Live Worker Location', '24/7 Availability',
            ].map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="grid grid-cols-3 px-6 py-4 border-b border-gray-50 dark:border-gray-800 last:border-0"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">{feat}</span>
                <div className="flex justify-center"><CheckCircle className="text-green-500" size={20} /></div>
                <div className="flex justify-center"><X className="text-red-400" size={20} /></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES GRID */}
      <section className="py-24 px-4 bg-white dark:bg-black">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">All Services</h2>
            <p className="text-gray-500 dark:text-gray-400">From plumbing to painting, we have experts for every need</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {SERVICE_CATEGORIES.map((cat, i) => (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/search?category=${cat.id}`)}
                className="flex flex-col items-center gap-3 p-5 bg-gray-50 dark:bg-surface-dark rounded-card border border-gray-100 dark:border-gray-800 hover:border-primary-light/30 dark:hover:border-primary-dark/30 transition-all"
              >
                <span className="text-3xl">{cat.icon}</span>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 text-center leading-tight">{cat.name}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 px-4 bg-gray-50 dark:bg-gray-900/30 overflow-hidden">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Loved by thousands</h2>
            <p className="text-gray-500 dark:text-gray-400">Real reviews from real customers across India</p>
          </motion.div>

          <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex-shrink-0 w-80 bg-white dark:bg-surface-dark rounded-card p-6 border border-gray-100 dark:border-gray-800 snap-start"
              >
                <div className="flex items-center gap-1 mb-4 text-amber-400">
                  {'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-light to-blue-400 flex items-center justify-center text-white font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white text-sm">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.city}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-24 px-4 bg-gradient-to-br from-primary-light to-blue-600 dark:from-blue-900 dark:to-blue-700">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to get started?</h2>
            <p className="text-xl text-blue-100 mb-10">Join 10,000+ satisfied customers who trust ServiConnect</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/register')}
                className="px-8 py-4 bg-white text-primary-light rounded-button text-lg font-semibold"
              >
                Get Started Free
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/worker-register')}
                className="px-8 py-4 border-2 border-white/50 text-white rounded-button text-lg font-semibold"
              >
                Become a Worker
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* WhatsApp Float Button */}
      <motion.a
        href="https://wa.me/917000000000?text=Hi, I need help with ServiConnect"
        target="_blank"
        rel="noreferrer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 text-white rounded-full shadow-lg shadow-green-500/40 flex items-center justify-center text-2xl"
      >
        <MessageCircle size={24} />
      </motion.a>
    </div>
  );
};

export default LandingPage;
