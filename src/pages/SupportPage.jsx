import React from 'react';

const SupportPage = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
    <div className="container mx-auto px-4 py-24 max-w-3xl text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-light text-white mb-6">?</div>
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Support</h1>
      <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">Need help with a booking or worker issue? Contact support using the free WhatsApp support link below.</p>
      <a href="https://wa.me/919999999999?text=Hello%20ServiConnect%20Support" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-light dark:bg-primary-dark text-white rounded-button font-semibold">Chat on WhatsApp</a>
    </div>
  </div>
);

export default SupportPage;
