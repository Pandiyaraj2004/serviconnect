import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bell, Moon, SunMedium, LogOut, Edit3, Save, Upload, MapPin, Loader2, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { INDIAN_CITIES, SERVICE_CATEGORIES, formatImageUrl } from '../utils/helpers';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import LocationPickerModal from '../components/LocationPickerModal';
import { BottomNav } from '../components/UI';
import toast from 'react-hot-toast';
import { subscribeToNotifications } from '../utils/notifications';
import { compressImage } from '../utils/imageCompression';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ProfileSettings = () => {
  const navigate = useNavigate();
  const { user, userProfile, logout, updateUserProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  // Upload and drag-and-drop progress states
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [workProgress, setWorkProgress] = useState(0);
  const [workUploading, setWorkUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Subscribe to notifications to get live count
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToNotifications(user.uid, (items) => {
      setUnreadCount(items.filter(i => !i.read).length);
    });
    return () => unsub();
  }, [user?.uid]);

  // Editable fields state
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    address: '',
    avatar: '',
    lat: 19.076,
    lng: 72.877,
    // Worker specific fields
    category: '',
    experience: '',
    pricingType: 'Hourly',
    price: '',
    bio: '',
    photos: [],
  });

  // Sync profile details when loaded
  useEffect(() => {
    if (!userProfile) return;
    setWhatsappOptIn(!!userProfile.whatsappOptIn);
    
    const loadDetails = async () => {
      const base = {
        name: userProfile.name || '',
        phone: userProfile.phone || '',
        address: userProfile.address || '',
        avatar: userProfile.avatar || '',
        lat: userProfile.lat || 19.076,
        lng: userProfile.lng || 72.877,
        category: '',
        experience: '',
        pricingType: 'Hourly',
        price: '',
        bio: '',
        photos: [],
      };
 
      if (userProfile.role === 'worker' && db) {
        try {
          const docSnap = await getDoc(doc(db, 'workers', userProfile.uid));
          if (docSnap.exists()) {
            const wData = docSnap.data();
            Object.assign(base, {
              category: wData.category || '',
              experience: wData.experience || '',
              pricingType: wData.pricingType || 'Hourly',
              price: wData.price || '',
              bio: wData.bio || '',
              avatar: wData.avatar || base.avatar, // prioritize worker avatar if set
              photos: wData.photos || [],
            });
          }
        } catch (err) {
          console.warn('Could not load worker details');
        }
      }
      setEditForm(base);
    };
    
    loadDetails();
  }, [userProfile]);

  const isDark = theme === 'dark';

  const handleToggleWhatsappOptIn = async () => {
    const newValue = !whatsappOptIn;
    setWhatsappOptIn(newValue);
    try {
      await updateUserProfile({ whatsappOptIn: newValue });
      if (userProfile?.role === 'worker' && db) {
        await updateDoc(doc(db, 'workers', user.uid), {
          whatsappOptIn: newValue
        });
      }
      toast.success(newValue ? 'WhatsApp Alerts Enabled (Opted-in)' : 'WhatsApp Alerts Disabled');
    } catch (err) {
      console.error(err);
      toast.error('Could not save notification preferences');
      setWhatsappOptIn(!newValue); // revert
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const uploadFileWithProgress = (url, file, name, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('image', file);
      if (name) {
        formData.append('name', name);
      }

      xhr.open('POST', url, true);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            resolve(res);
          } catch (err) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          try {
            const res = JSON.parse(xhr.responseText);
            reject(new Error(res.error || 'Upload failed'));
          } catch {
            reject(new Error('Upload failed with status ' + xhr.status));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });
  };

  const uploadMultipleFilesWithProgress = (url, files, name, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      files.forEach(file => formData.append('images', file));
      if (name) {
        formData.append('name', name);
      }

      xhr.open('POST', url, true);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            resolve(res);
          } catch (err) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          try {
            const res = JSON.parse(xhr.responseText);
            reject(new Error(res.error || 'Upload failed'));
          } catch {
            reject(new Error('Upload failed with status ' + xhr.status));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPG, JPEG, PNG, and WEBP are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size too large. Maximum limit is 5 MB.');
      return;
    }

    setAvatarUploading(true);
    setAvatarProgress(0);
    const toastId = toast.loading('Compressing photo...');
    try {
      const compressedFile = await compressImage(file);
      toast.loading('Uploading photo...', { id: toastId });
      
      const roleEndpoint = userProfile?.role === 'worker' ? 'worker' : 'customer';
      const data = await uploadFileWithProgress(
        `${API_URL}/api/upload/profile/${roleEndpoint}`,
        compressedFile,
        editForm.name || 'user',
        setAvatarProgress
      );

      if (data.url) {
        setEditForm(prev => ({ ...prev, avatar: data.url }));
        toast.success('Photo uploaded!', { id: toastId });
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err) {
      toast.error('Upload failed: ' + err.message, { id: toastId });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleWorkPhotosChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (editForm.photos.length + files.length > 10) {
      toast.error('You can upload up to 10 work photos only');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Invalid file type for ${file.name}. Only JPG, JPEG, PNG, and WEBP are allowed.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Maximum limit is 5 MB.`);
        return;
      }
    }

    setWorkUploading(true);
    setWorkProgress(0);
    const toastId = toast.loading('Compressing work photos...');
    try {
      const compressedFiles = await Promise.all(
        files.map(file => compressImage(file))
      );
      toast.loading('Uploading work photos...', { id: toastId });

      const data = await uploadMultipleFilesWithProgress(
        `${API_URL}/api/upload/work-photos`,
        compressedFiles,
        editForm.name || 'worker',
        setWorkProgress
      );

      if (data.urls) {
        setEditForm(prev => ({ ...prev, photos: [...prev.photos, ...data.urls] }));
        toast.success('Work photos uploaded!', { id: toastId });
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err) {
      toast.error('Upload failed: ' + err.message, { id: toastId });
    } finally {
      setWorkUploading(false);
    }
  };

  const handleDeletePhoto = async (url) => {
    const toastId = toast.loading('Removing photo...');
    try {
      setEditForm(prev => ({ ...prev, photos: prev.photos.filter(p => p !== url) }));
      const res = await fetch(`${API_URL}/api/upload/delete-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        toast.success('Photo removed successfully', { id: toastId });
      } else {
        throw new Error(data.error || 'Failed to delete photo from storage');
      }
    } catch (err) {
      toast.error('Could not remove photo: ' + err.message, { id: toastId });
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      const fakeEvent = { target: { files } };
      await handleWorkPhotosChange(fakeEvent);
    }
  };

  const handleSave = async () => {
    if (!editForm.name.trim()) return toast.error('Name is required');
    if (!/^[6-9]\d{9}$/.test(editForm.phone)) return toast.error('Enter valid 10-digit phone number');
    
    setLoading(true);
    try {
      if (!db || !userProfile) return;
      
      const role = userProfile.role || 'customer';

      // 1. Update basic user profile in users collection
      const userUpdates = {
        name: editForm.name.trim(),
        phone: editForm.phone,
        address: editForm.address.trim(),
        avatar: editForm.avatar,
        lat: editForm.lat,
        lng: editForm.lng,
      };
      
      await updateUserProfile(userUpdates);

      // 2. If Worker, update workers collection as well
      if (role === 'worker') {
        const workerRef = doc(db, 'workers', userProfile.uid);
        await updateDoc(workerRef, {
          name: editForm.name.trim(),
          phone: editForm.phone,
          address: editForm.address.trim(),
          avatar: editForm.avatar,
          lat: editForm.lat,
          lng: editForm.lng,
          category: editForm.category,
          experience: editForm.experience,
          pricingType: editForm.pricingType,
          price: parseFloat(editForm.price) || 0,
          bio: editForm.bio.trim(),
          photos: editForm.photos,
          updatedAt: serverTimestamp(),
        });
      }

      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      toast.error('Could not save profile changes: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900 px-4 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile & Settings</h1>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-light/10 text-primary-light dark:text-primary-dark rounded-button text-xs font-semibold"
          >
            <Edit3 size={14} /> Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 border rounded-button text-xs font-semibold text-gray-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-light text-white rounded-button text-xs font-bold disabled:opacity-70"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* Profile Card */}
        <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-100 dark:border-gray-800 p-6 shadow-soft">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {editForm.avatar ? (
                <img src={formatImageUrl(editForm.avatar)} alt="Profile photo" className="w-16 h-16 rounded-full object-cover border" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-light to-blue-400 flex items-center justify-center text-white text-2xl font-black">
                  {(editForm.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              {isEditing && (
                <div className="absolute -bottom-1 -right-1">
                  <input
                    type="file"
                    accept="image/*"
                    id="avatar-upload-file"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={avatarUploading}
                  />
                  <label htmlFor="avatar-upload-file" className={`w-6 h-6 rounded-full bg-primary-light text-white flex items-center justify-center cursor-pointer shadow border ${avatarUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload size={12} />
                  </label>
                </div>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-white text-[8px] font-bold">
                  <span>{avatarProgress}%</span>
                  <div className="w-8 bg-gray-700 h-0.5 rounded-full overflow-hidden mt-0.5">
                    <div className="bg-white h-full transition-all" style={{ width: `${avatarProgress}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-light bg-primary-light/10 px-2 py-0.5 rounded">
                {userProfile?.role || 'Customer'}
              </span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1.5">
                {userProfile?.name || user?.displayName || 'User'}
              </h2>
              <p className="text-xs text-gray-500 truncate max-w-[250px]">{editForm.address || 'Location not set'}</p>
            </div>
          </div>
        </div>

        {/* Info form block */}
        <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-100 dark:border-gray-800 p-6 space-y-4 shadow-soft">
          <div className="flex items-center gap-3">
            <User size={18} className="text-primary-light dark:text-primary-dark" />
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Personal Info</h3>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-wide">Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-input text-sm mt-1 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-primary-light"
                />
              ) : (
                <p className="text-sm text-gray-850 dark:text-white mt-0.5">{editForm.name || 'Not set'}</p>
              )}
            </div>

            {/* Email (Readonly) */}
            <div>
              <label className="text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-wide">Email (Cannot be changed)</label>
              <p className="text-sm text-gray-500 mt-0.5">{user?.email || 'Not set'}</p>
            </div>

            {/* Phone */}
            <div>
              <label className="text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-wide">Phone/Mobile Number</label>
              {isEditing ? (
                <input
                  type="tel"
                  maxLength={10}
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border rounded-input text-sm mt-1 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-primary-light"
                />
              ) : (
                <p className="text-sm text-gray-850 dark:text-white mt-0.5">{editForm.phone || 'Not set'}</p>
              )}
            </div>

            {/* Physical Address */}
            <div>
              <label className="text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-wide">Address</label>
              {isEditing ? (
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-4 py-2 border rounded-input text-sm mt-1 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-primary-light resize-none"
                />
              ) : (
                <p className="text-sm text-gray-850 dark:text-white mt-0.5">{editForm.address || 'Not set'}</p>
              )}
            </div>

            {/* Map coordinates selection */}
            <div>
              <label className="text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-wide">Coordinates</label>
              {isEditing ? (
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 px-4 py-2.5 border bg-gray-100 dark:bg-gray-800 rounded-input text-xs text-gray-500 font-mono">
                    {editForm.lat.toFixed(5)}, {editForm.lng.toFixed(5)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapOpen(true)}
                    className="px-3 bg-gray-200 dark:bg-gray-750 text-gray-800 dark:text-white font-bold rounded-input text-xs flex items-center gap-1"
                  >
                    <MapPin size={14} /> Update Pin
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-500 font-mono mt-0.5">{editForm.lat.toFixed(5)}, {editForm.lng.toFixed(5)}</p>
              )}
            </div>

            <LocationPickerModal
              isOpen={isMapOpen}
              onClose={() => setIsMapOpen(false)}
              onSave={({ lat, lng, address }) => setEditForm(prev => ({ ...prev, lat, lng, address }))}
              initialLat={editForm.lat}
              initialLng={editForm.lng}
              initialAddress={editForm.address}
            />

            {/* WORKER SPECIFIC EDITING FIELDS */}
            {userProfile?.role === 'worker' && (
              <>
                <div className="border-t border-gray-150 dark:border-gray-850 pt-4 space-y-4">
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 text-xs uppercase tracking-wide">Worker Details</h4>
                  
                  {/* Category */}
                  <div>
                    <label className="text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-wide">Service Category</label>
                    {isEditing ? (
                      <select
                        value={editForm.category}
                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full px-4 py-2 border rounded-input text-sm mt-1 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                      >
                        <option value="">Select Category</option>
                        {SERVICE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-850 dark:text-white mt-0.5 capitalize">{editForm.category || 'Not set'}</p>
                    )}
                  </div>

                  {/* Experience */}
                  <div>
                    <label className="text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-wide">Experience</label>
                    {isEditing ? (
                      <select
                        value={editForm.experience}
                        onChange={e => setEditForm({ ...editForm, experience: e.target.value })}
                        className="w-full px-4 py-2 border rounded-input text-sm mt-1 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                      >
                        <option value="">Select experience</option>
                        {['Less than 1', '1-2', '3-5', '5-10', '10+'].map(e => <option key={e} value={e}>{e} years</option>)}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-850 dark:text-white mt-0.5">{editForm.experience ? `${editForm.experience} years` : 'Not set'}</p>
                    )}
                  </div>

                  {/* Pricing Rate & Amount */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-wide">Rate Type</label>
                      {isEditing ? (
                        <select
                          value={editForm.pricingType}
                          onChange={e => setEditForm({ ...editForm, pricingType: e.target.value })}
                          className="w-full px-4 py-2 border rounded-input text-sm mt-1 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
                        >
                          <option value="Hourly">Hourly</option>
                          <option value="Daily">Daily</option>
                          <option value="Fixed">Fixed</option>
                        </select>
                      ) : (
                        <p className="text-sm text-gray-850 dark:text-white mt-0.5">{editForm.pricingType || 'Not set'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-wide">Rate (₹)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.price}
                          onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                          className="w-full px-4 py-2 border rounded-input text-sm mt-1 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-primary-light"
                        />
                      ) : (
                        <p className="text-sm text-gray-850 dark:text-white mt-0.5">₹{editForm.price || '0'}</p>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-wide">Bio</label>
                    {isEditing ? (
                      <textarea
                        rows={2}
                        value={editForm.bio}
                        onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                        className="w-full px-4 py-2 border rounded-input text-sm mt-1 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-primary-light resize-none"
                      />
                    ) : (
                      <p className="text-sm text-gray-650 dark:text-gray-400 mt-0.5 leading-relaxed">{editForm.bio || 'No bio set'}</p>
                    )}
                  </div>

                  {/* Portfolio Work Photos */}
                  <div className="pt-4 border-t border-gray-150 dark:border-gray-850">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-gray-550 dark:text-gray-400 uppercase tracking-wide">Portfolio Work Photos</label>
                      <span className="text-[10px] text-gray-400">{editForm.photos?.length || 0}/10</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {editForm.photos?.map((url, i) => (
                        <div key={i} className="aspect-square bg-gray-100 dark:bg-gray-850 rounded-lg overflow-hidden relative group border border-gray-200 dark:border-gray-800">
                          <img src={url} alt={`Work ${i+1}`} className="w-full h-full object-cover" />
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(url)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}

                      {isEditing && (editForm.photos?.length || 0) < 10 && (
                        <div
                          className={`aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-850 transition-all ${
                            dragActive ? 'border-primary-light bg-blue-50/10' : 'border-gray-250 dark:border-gray-750'
                          }`}
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                        >
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            id="settings-work-photos-upload"
                            className="hidden"
                            onChange={handleWorkPhotosChange}
                            disabled={workUploading}
                          />
                          <label htmlFor="settings-work-photos-upload" className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                            <span className="text-lg font-bold">+</span>
                            <span className="text-[8px] mt-0.5 text-center px-1">Drop / Browse</span>
                          </label>
                        </div>
                      )}
                    </div>

                    {workUploading && (
                      <div className="mt-2.5">
                        <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                          <span>Uploading work photos...</span>
                          <span>{workProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-850 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-primary-light dark:bg-primary-dark h-full transition-all duration-300" style={{ width: `${workProgress}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notification toggle */}
        <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-100 dark:border-gray-800 p-6 space-y-4 shadow-soft">
          <div className="flex items-center gap-4">
            <Bell size={20} className="text-primary-light dark:text-primary-dark" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage how you receive alerts.</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-650 dark:text-gray-300">WhatsApp Alerts (Opt-in)</span>
            <button
              onClick={handleToggleWhatsappOptIn}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 ${whatsappOptIn ? 'bg-green-500' : 'bg-gray-400'}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${whatsappOptIn ? 'left-7' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Theme select */}
        <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-100 dark:border-gray-800 p-6 space-y-4 shadow-soft">
          <div className="flex items-center gap-4">
            <Moon size={20} className="text-primary-light dark:text-primary-dark" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Theme</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Toggle between light and dark mode.</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <SunMedium size={16} /> {isDark ? 'Dark mode active' : 'Light mode active'}
            </div>
            <button onClick={toggleTheme} className="px-4 py-2 bg-primary-light dark:bg-primary-dark text-white rounded-button font-bold text-xs">
              Switch Theme
            </button>
          </div>
        </div>

        {/* Logout block */}
        <div className="bg-white dark:bg-surface-dark rounded-card border border-gray-100 dark:border-gray-800 p-6 shadow-soft">
          <button onClick={handleLogout} className="w-full py-3 bg-red-500 hover:bg-red-650 text-white rounded-button font-bold flex items-center justify-center gap-2">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>
      <BottomNav active="profile" onNavigate={navigate} unreadNotifications={unreadCount} userRole={userProfile?.role} />
    </div>
  );
};

export default ProfileSettings;
