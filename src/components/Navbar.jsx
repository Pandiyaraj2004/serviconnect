import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sun, Moon, Menu, X, Hammer, User, LogIn, LogOut, MapPin, Search, Bell } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToNotifications } from '../utils/notifications';

const Navbar = ({ isAuthPage = false }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, userProfile, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }
    const unsub = subscribeToNotifications(user.uid, (items) => {
      setUnreadCount(items.filter(i => !i.read).length);
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getNavLinks = () => {
    if (!user) {
      return [
        { name: 'How it works', href: '/#how-it-works' },
        { name: 'For Workers', href: '/worker-register' },
        { name: 'About', href: '/about' },
      ];
    }
    const role = userProfile?.role || 'customer';
    if (role === 'admin') {
      return [
        { name: 'Dashboard', href: '/admin' },
        { name: 'Activity', href: '/notifications' },
        { name: 'Profile Settings', href: '/settings' },
      ];
    } else if (role === 'worker') {
      return [
        { name: 'Dashboard', href: '/worker-dashboard' },
        { name: 'Activity', href: '/notifications' },
        { name: 'Profile Settings', href: '/settings' },
      ];
    } else {
      return [
        { name: 'Home', href: '/dashboard' },
        { name: 'Search Workers', href: '/search' },
        { name: 'My Bookings', href: '/bookings' },
        { name: 'Activity', href: '/notifications' },
        { name: 'Profile Settings', href: '/settings' },
      ];
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setIsMobileMenuOpen(false);
  };

  const bgClass = isScrolled 
    ? 'bg-white dark:bg-gray-900 shadow-md border-b border-gray-100 dark:border-gray-800' 
    : 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-100/50 dark:border-gray-800/50';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${bgClass}`}>
      <div className="max-w-7xl mx-auto">
        {/* Main Navbar */}
        <div className="flex items-center justify-between h-16 px-4 md:px-6">
          {/* Left: Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <div className="bg-primary-light dark:bg-primary-dark p-2 rounded-lg group-hover:scale-110 transition-transform duration-200">
              <Hammer className="text-white w-5 h-5" />
            </div>
            <span className="hidden sm:inline text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              ServiConnect
            </span>
          </Link>

          {/* Center: Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6 flex-1 justify-center ml-8">
            {getNavLinks().map((link) => {
              const isHash = link.href.startsWith('/#');
              return isHash ? (
                <a 
                  key={link.name} 
                  href={link.href} 
                  className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-primary-light dark:hover:text-primary-dark transition-colors duration-200 whitespace-nowrap"
                >
                  {link.name}
                </a>
              ) : (
                <Link 
                  key={link.name} 
                  to={link.href} 
                  className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-primary-light dark:hover:text-primary-dark transition-colors duration-200 whitespace-nowrap"
                >
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon size={20} className="text-gray-600 dark:text-gray-400" />
              ) : (
                <Sun size={20} className="text-gray-600 dark:text-gray-400" />
              )}
            </button>

            {/* Auth Buttons - Desktop */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <>
                  <button 
                    onClick={() => navigate('/notifications')}
                    className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                    aria-label="Notifications"
                  >
                    <Bell size={20} className="text-gray-600 dark:text-gray-400" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  <button 
                    onClick={() => navigate(userProfile?.role === 'admin' ? '/admin' : userProfile?.role === 'worker' ? '/worker-dashboard' : '/dashboard')}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-light dark:bg-primary-dark text-white rounded-lg font-medium hover:opacity-90 active:scale-95 transition-all duration-200"
                  >
                    <User size={18} />
                    <span className="hidden lg:inline">Dashboard</span>
                  </button>

                  <button 
                    onClick={handleLogout}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200" 
                    aria-label="Logout"
                  >
                    <LogOut size={20} className="text-gray-600 dark:text-gray-400" />
                  </button>

                  <button 
                    onClick={() => navigate('/settings')}
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-light to-blue-400 flex items-center justify-center text-white text-sm font-bold hover:shadow-lg transition-shadow duration-200"
                    title={userProfile?.name || 'Profile'}
                  >
                    {(userProfile?.name || user?.displayName || 'U').charAt(0).toUpperCase()}
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => navigate('/login')}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-light dark:bg-primary-dark text-white rounded-lg font-medium hover:opacity-90 active:scale-95 transition-all duration-200"
                >
                  <LogIn size={18} />
                  <span>Login</span>
                </button>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              ) : (
                <Menu size={20} className="text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900"
            >
              <div className="px-4 py-4 flex flex-col gap-3">
                {/* Mobile Nav Links */}
                {getNavLinks().map((link) => {
                  const isHash = link.href.startsWith('/#');
                  return isHash ? (
                    <a 
                      key={link.name} 
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors duration-200"
                    >
                      {link.name}
                    </a>
                  ) : (
                    <Link 
                      key={link.name} 
                      to={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  );
                })}

                {/* Divider */}
                <div className="h-px bg-gray-200 dark:bg-gray-800 my-2"></div>

                {/* Mobile Auth */}
                {user ? (
                  <>
                    <button 
                      onClick={() => { navigate('/notifications'); setIsMobileMenuOpen(false); }}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors duration-200 w-full"
                    >
                      <div className="flex items-center gap-3">
                        <Bell size={18} />
                        <span>Notifications</span>
                      </div>
                      {unreadCount > 0 && (
                        <span className="min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    <button 
                      onClick={() => { navigate(userProfile?.role === 'admin' ? '/admin' : userProfile?.role === 'worker' ? '/worker-dashboard' : '/dashboard'); setIsMobileMenuOpen(false); }}
                      className="flex items-center gap-3 px-3 py-2 bg-primary-light dark:bg-primary-dark text-white rounded-lg font-medium transition-colors duration-200"
                    >
                      <User size={18} />
                      <span>Dashboard</span>
                    </button>

                    <button 
                      onClick={() => { navigate('/settings'); setIsMobileMenuOpen(false); }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors duration-200"
                    >
                      <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-light to-blue-400 flex items-center justify-center text-white text-sm font-bold">
                        {(userProfile?.name || user?.displayName || 'U').charAt(0).toUpperCase()}
                      </span>
                      <span>Profile</span>
                    </button>

                    <button 
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors duration-200"
                    >
                      <LogOut size={18} />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => { navigate('/login'); setIsMobileMenuOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 bg-primary-light dark:bg-primary-dark text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    <LogIn size={18} />
                    <span>Login</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};

export default Navbar;
