import React from 'react';
import { motion } from 'framer-motion';

// Skeleton loader component
export const Skeleton = ({ className = '' }) => (
  <div className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
  </div>
);

// Worker card skeleton
export const WorkerCardSkeleton = () => (
  <div className="bg-white dark:bg-surface-dark rounded-card p-4 border border-black/5 dark:border-white/5">
    <div className="flex gap-4">
      <Skeleton className="w-16 h-16 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  </div>
);

// Stats card skeleton
export const StatCardSkeleton = () => (
  <div className="bg-white dark:bg-surface-dark rounded-card p-6 border border-black/5 dark:border-white/5 space-y-3">
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-8 w-1/3" />
    <Skeleton className="h-3 w-2/3" />
  </div>
);

// Page transition wrapper
export const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

// Staggered list animation
export const StaggerContainer = ({ children, className = '' }) => (
  <motion.div
    className={className}
    initial="hidden"
    animate="visible"
    variants={{
      hidden: {},
      visible: { transition: { staggerChildren: 0.08 } }
    }}
  >
    {children}
  </motion.div>
);

export const StaggerItem = ({ children, className = '' }) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
    }}
  >
    {children}
  </motion.div>
);

// Badge component
export const Badge = ({ variant = 'default', children, className = '' }) => {
  const variants = {
    default: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    primary: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    success: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    warning: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    danger: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    ai: 'bg-gradient-to-r from-blue-500 to-purple-600 text-white',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

// Star rating display
export const StarRating = ({ rating, max = 5, size = 'sm' }) => {
  const sizeClass = size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-xl';
  return (
    <div className={`flex items-center gap-0.5 ${sizeClass}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < Math.floor(rating) ? 'text-amber-400' : i < rating ? 'text-amber-300' : 'text-gray-300'}>
          ★
        </span>
      ))}
    </div>
  );
};

// Empty state
export const EmptyState = ({ title, description, illustration = '🔍', action }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center px-6">
    <div className="text-6xl mb-6">{illustration}</div>
    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
    <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">{description}</p>
    {action}
  </div>
);

// Loading spinner
export const Spinner = ({ size = 'md', color = 'blue' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className={`${sizes[size]} border-2 border-current border-t-transparent rounded-full animate-spin text-${color}-500`} />
  );
};

// Input field with floating label
export const FloatingInput = ({ label, error, className = '', ...props }) => (
  <div className={`relative ${className}`}>
    <input
      {...props}
      placeholder=" "
      className={`peer w-full px-4 pt-6 pb-2 bg-white dark:bg-surface-dark border rounded-input text-sm outline-none transition-all
        ${error 
          ? 'border-red-400 focus:border-red-500' 
          : 'border-gray-200 dark:border-gray-700 focus:border-primary-light dark:focus:border-primary-dark'
        }
        dark:text-text-primary-dark`}
    />
    <label className="absolute left-4 top-2 text-xs text-gray-500 dark:text-gray-400 transition-all
      peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400
      peer-focus:top-2 peer-focus:text-xs peer-focus:text-primary-light dark:peer-focus:text-primary-dark">
      {label}
    </label>
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

// Bottom Navigation for mobile
export const BottomNav = ({ active, onNavigate, unreadNotifications = 0, userRole }) => {
  const tabs = userRole === 'admin' ? [
    { id: 'home', icon: '🏠', label: 'Admin', path: '/admin' },
    { id: 'notifications', icon: '🔔', label: 'Activity', path: '/notifications' },
    { id: 'profile', icon: '👤', label: 'Profile', path: '/settings' },
  ] : userRole === 'worker' ? [
    { id: 'home', icon: '🏠', label: 'Home', path: '/worker-dashboard' },
    { id: 'notifications', icon: '🔔', label: 'Activity', path: '/notifications' },
    { id: 'profile', icon: '👤', label: 'Profile', path: '/settings' },
  ] : [
    { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
    { id: 'search', icon: '🔍', label: 'Search', path: '/search' },
    { id: 'bookings', icon: '📋', label: 'Bookings', path: '/bookings' },
    { id: 'notifications', icon: '🔔', label: 'Activity', path: '/notifications' },
    { id: 'profile', icon: '👤', label: 'Profile', path: '/settings' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-black border-t border-gray-100 dark:border-gray-900 px-2 py-2 flex justify-around md:hidden safe-area-pb">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onNavigate(tab.path)}
          className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
            active === tab.id ? 'text-primary-light dark:text-primary-dark' : 'text-gray-400'
          }`}
        >
          <span className={`text-xl transition-transform ${active === tab.id ? 'scale-110' : ''}`}>
            {tab.icon}
          </span>
          {/* Unread badge for notifications */}
          {tab.id === 'notifications' && unreadNotifications > 0 && (
            <span className="absolute -top-0.5 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
          <span className={`text-[10px] font-medium leading-tight ${active === tab.id ? 'font-bold' : ''}`}>{tab.label}</span>
          {active === tab.id && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-light dark:bg-primary-dark" />
          )}
        </button>
      ))}
    </div>
  );
};

