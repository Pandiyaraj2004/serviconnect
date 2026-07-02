import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signOut, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, setPersistence, browserLocalPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // activeRole allows the same Firebase user to switch between 'customer' and 'worker' roles
  const [activeRole, setActiveRoleState] = useState(() => localStorage.getItem('sc_active_role') || null);

  const setActiveRole = (role) => {
    setActiveRoleState(role);
    if (role) localStorage.setItem('sc_active_role', role);
    else localStorage.removeItem('sc_active_role');
  };

  const ensureUserProfile = async (firebaseUser, extra = {}, retries = 0) => {
    if (!db) return null;
    try {
      const docRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(docRef);

      const baseProfile = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || extra.name || '',
        email: firebaseUser.email || extra.email || '',
        phone: firebaseUser.phoneNumber || extra.phone || '',
        avatar: firebaseUser.photoURL || extra.avatar || null,
        role: extra.role || 'customer',
        city: extra.city || '',
      };

      if (!docSnap.exists()) {
        const createdProfile = {
          ...baseProfile,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        try {
          await setDoc(docRef, createdProfile);
          return createdProfile;
        } catch (writeErr) {
          console.warn('Could not write profile to Firestore:', writeErr.message);
          return createdProfile;
        }
      }

      const existing = docSnap.data();
      return { ...existing, ...baseProfile, ...extra };
    } catch (err) {
      console.warn(`Profile fetch failed (attempt ${retries + 1}):`, err.message);
      if (retries < 1 && err.code !== 'permission-denied') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return ensureUserProfile(firebaseUser, extra, retries + 1);
      }
      return {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || extra.name || 'User',
        email: firebaseUser.email || extra.email || '',
        phone: extra.phone || '',
        avatar: firebaseUser.photoURL || null,
        role: extra.role || 'customer',
        city: extra.city || '',
      };
    }
  };

  useEffect(() => {
    let mounted = true;

    if (!isFirebaseConfigured) {
      console.log('Firebase Auth not available. Using demo mode.');
      if (mounted) setLoading(false);
      return;
    }

    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('Could not enable auth persistence:', err.message);
    });

    // Check redirect result on mount
    getRedirectResult(auth).then((result) => {
      if (mounted && result && result.user) {
        const savedRole = localStorage.getItem('sc_active_role') || 'customer';
        ensureUserProfile(result.user).then(profile => {
          if (mounted && profile) {
            setUserProfile({ ...profile, role: savedRole });
          }
        }).catch(err => console.warn('Redirect profile load failed:', err));
        toast.success('Logged in successfully!');
      }
    }).catch((err) => {
      console.error('Redirect sign-in error:', err);
      if (err.code === 'auth/network-request-failed') {
        toast.error('Network request failed during Google Login. Please check your internet connection or disable ad-blockers.');
      } else if (err.code !== 'auth/popup-closed-by-user') {
        toast.error(err.message || 'Redirect login failed');
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);

        ensureUserProfile(firebaseUser).then(profile => {
          if (mounted && profile) {
            // If we have an activeRole stored, apply it to the profile
            const savedRole = localStorage.getItem('sc_active_role');
            if (savedRole && (savedRole === 'customer' || savedRole === 'worker' || savedRole === 'admin')) {
              setUserProfile({ ...profile, role: savedRole });
            } else {
              setUserProfile(profile);
            }
          }
        }).catch(err => {
          console.warn('Background profile fetch error:', err.message);
        });
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const updateUserProfile = async (updates) => {
    if (!user || !db) throw new Error('User profile is not available');
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { ...updates, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      setUserProfile(prev => ({ ...prev, ...updates }));
    } catch (err) {
      console.error('Profile update error:', err.message);
      throw err;
    }
  };

  const loginWithGoogle = async (requestedRole = 'customer') => {
    if (!isFirebaseConfigured || !googleProvider) {
      toast.error('Firebase is not configured. Check .env file.');
      throw new Error('Firebase not available');
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setActiveRole(requestedRole);
      ensureUserProfile(result.user).then(profile => {
        if (profile) setUserProfile({ ...profile, role: requestedRole });
      }).catch(err => console.warn('Profile load failed:', err));
      toast.success('Logged in successfully!');
      return result;
    } catch (err) {
      if (err.code === 'auth/network-request-failed' || err.code === 'auth/popup-blocked') {
        console.warn('Google Popup login failed/blocked, attempting redirect login...', err);
        toast.loading('Popup blocked or network failed. Redirecting to Google Login instead...');
        setActiveRole(requestedRole);
        await signInWithRedirect(auth, googleProvider);
      } else {
        if (err.code !== 'auth/popup-closed-by-user') {
          toast.error(err.message || 'Login failed');
        }
        throw err;
      }
    }
  };

  const loginWithEmail = async (email, password, requestedRole = 'customer') => {
    // Admin bypass
    if (email === 'pandi' && password === 'pandi') {
      const adminUser = { uid: 'admin_pandi', email: 'pandi@serviconnect.com', displayName: 'Admin Pandi' };
      setUser(adminUser);
      setUserProfile({ uid: 'admin_pandi', name: 'Admin Pandi', email: 'pandi@serviconnect.com', role: 'admin', city: 'System Control' });
      setActiveRole('admin');
      toast.success('Welcome Administrator!');
      return { user: adminUser };
    }
    if (!isFirebaseConfigured) {
      toast.error('Firebase is not configured. Check .env file.');
      throw new Error('Firebase not available');
    }
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      setActiveRole(requestedRole);
      ensureUserProfile(result.user).then(profile => {
        if (profile) setUserProfile({ ...profile, role: requestedRole });
      }).catch(err => console.warn('Profile load failed:', err));
      toast.success('Welcome back!');
      return result;
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('Invalid email or password. Please try again.');
      } else {
        toast.error(err.message || 'Login failed');
      }
      throw err;
    }
  };

  const registerWithEmail = async ({ email, password, name, city, phone, role = 'customer' }) => {
    if (!isFirebaseConfigured) {
      toast.error('Firebase is not configured. Check .env file.');
      throw new Error('Firebase not available');
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      setActiveRole(role);
      ensureUserProfile(result.user, { name, email, phone, city, role }).then(profile => {
        if (profile) setUserProfile({ ...profile, role });
      }).catch(err => console.warn('Profile creation failed:', err));
      toast.success('Account created successfully!');
      return result;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        toast.error('An account with this email already exists.');
      } else {
        toast.error(err.message || 'Registration failed');
      }
      throw err;
    }
  };

  const logout = async () => {
    if (!auth) return;
    try {
      // Handle admin bypass logout
      if (user?.uid === 'admin_pandi') {
        setUser(null);
        setUserProfile(null);
        setActiveRole(null);
        toast.success('Logged out successfully');
        return;
      }
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setActiveRole(null);
      toast.success('Logged out successfully');
    } catch (err) {
      console.error('Logout error:', err.message);
      toast.error('Logout failed');
    }
  };

  // Switch role without re-logging in (for dual-role users)
  const switchRole = (newRole) => {
    setActiveRole(newRole);
    setUserProfile(prev => prev ? { ...prev, role: newRole } : prev);
    toast.success(`Switched to ${newRole} mode`);
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      activeRole,
      isAuthenticated: Boolean(user),
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      logout,
      updateUserProfile,
      switchRole,
      setActiveRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
