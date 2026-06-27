import React from 'react';

const PrivacyPage = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
    <div className="container mx-auto px-4 py-24 max-w-3xl">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">Privacy Policy</h1>
      <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">ServiConnect values your privacy. We use Firebase securely to store user profiles, bookings, and chat messages. No data is shared with third parties without your consent.</p>
      <p className="text-gray-600 dark:text-gray-300 leading-relaxed">This site uses browser geolocation only when requested, and WhatsApp notifications are sent through direct wa.me links. All AI-related content is generated using Gemini API as configured in your environment.</p>
    </div>
  </div>
);

export default PrivacyPage;
