import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

const Layout = ({ children }) => {
  const location = useLocation();
  
  // Hide navbar/footer on specific pages if needed (e.g., Auth, Admin)
  const hideLayout = ['/login', '/register'].includes(location.pathname);

  return (
    <div className="flex flex-col min-h-screen">
      {!hideLayout && <Navbar />}
      <main className={`flex-grow ${!hideLayout ? 'pt-16' : ''}`}>
        {children}
      </main>
      {!hideLayout && <Footer />}
    </div>
  );
};

export default Layout;
