import React from 'react';

const TermsPage = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
    <div className="container mx-auto px-4 py-24 max-w-3xl">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">Terms of Service</h1>
      <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">By using ServiConnect, you agree to the free service terms, including the use of Firebase Authentication, Firestore, Realtime Database, and Firestore Storage. You also agree to receive WhatsApp messages through the standard wa.me flow when confirming bookings.</p>
      <p className="text-gray-600 dark:text-gray-300 leading-relaxed">All payments are handled offline between customer and worker. ServiConnect does not process payments directly.</p>
    </div>
  </div>
);

export default TermsPage;
