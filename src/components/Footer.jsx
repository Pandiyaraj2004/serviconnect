import React from 'react';
import { Hammer, Twitter, Instagram, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="py-12 bg-surface-light dark:bg-black border-t border-black/5 dark:border-white/5">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="bg-primary-light dark:bg-primary-dark p-1.5 rounded-lg">
                <Hammer className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                ServiConnect
              </span>
            </Link>
            <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm leading-relaxed">
              Premium AI-powered local service worker finder. Verified experts, booked in minutes.
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-6">Platform</h4>
            <ul className="space-y-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">
              <li><Link to="/search" className="hover:text-primary-light transition-colors">Find a Worker</Link></li>
              <li><Link to="/worker-register" className="hover:text-primary-light transition-colors">Join as Worker</Link></li>
              <li><Link to="/about" className="hover:text-primary-light transition-colors">How it works</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6">Company</h4>
            <ul className="space-y-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">
              <li><Link to="/privacy" className="hover:text-primary-light transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-primary-light transition-colors">Terms of Service</Link></li>
              <li><Link to="/support" className="hover:text-primary-light transition-colors">Support</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6">Social</h4>
            <div className="flex gap-4">
              <a href="#" className="p-2 rounded-full bg-black/5 dark:bg-white/5 hover:bg-primary-light hover:text-white transition-all">
                <Twitter size={18} />
              </a>
              <a href="#" className="p-2 rounded-full bg-black/5 dark:bg-white/5 hover:bg-primary-light hover:text-white transition-all">
                <Instagram size={18} />
              </a>
              <a href="#" className="p-2 rounded-full bg-black/5 dark:bg-white/5 hover:bg-primary-light hover:text-white transition-all">
                <Linkedin size={18} />
              </a>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-black/5 dark:border-white/5 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
          &copy; {new Date().getFullYear()} ServiConnect. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
