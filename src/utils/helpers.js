// Haversine formula for distance calculation
export function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

// WhatsApp notification helpers
export const sendWorkerBookingNotification = (workerPhone, { customerName, category, problemDescription, customerAddress, bookingDate, bookingTime, customerPhone }) => {
  const message = `New Booking Request — ServiConnect\nCustomer: ${customerName}\nService: ${category}\nProblem: ${problemDescription}\nAddress: ${customerAddress}\nDate: ${bookingDate}\nTime: ${bookingTime}\nCustomer Phone: ${customerPhone}`;
  const url = `https://wa.me/91${workerPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

export const sendCustomerConfirmation = (customerPhone, { workerName, category, workerPhone, bookingDate, bookingTime }) => {
  const message = `Booking Confirmed — ServiConnect\nWorker: ${workerName}\nCategory: ${category}\nAI Verified: Yes\nWorker Phone: ${workerPhone}\nDate: ${bookingDate}\nTime: ${bookingTime}`;
  const url = `https://wa.me/91${customerPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

export const sendJobCompletionOTP = (customerPhone, { customerName, workerName, otp }) => {
  const message = `ServiConnect Job Completion OTP\nHello ${customerName}, ${workerName} has completed the work.\nYour OTP is: ${otp}\nShare this OTP with the worker only if satisfied.`;
  const url = `https://wa.me/91${customerPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

export const sendReviewReminder = (customerPhone, { customerName, workerName, category }) => {
  const message = `Rate your experience — ServiConnect\nHello ${customerName}, please rate ${workerName} for the ${category} service completed today.\nOpen app to leave review.`;
  const url = `https://wa.me/91${customerPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

export const sendWorkerReviewNotification = (workerPhone, { customerName, rating, category }) => {
  const message = `New Review — ServiConnect\n${customerName} gave you ${rating} stars for ${category} service.\nGreat job! Keep it up.`;
  const url = `https://wa.me/91${workerPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

// Format time ago
export function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Generate greeting based on time
export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// Format date
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
}

// Service categories
export const SERVICE_CATEGORIES = [
  { id: 'plumber', name: 'Plumber', icon: '🔧', color: '#0071E3' },
  { id: 'electrician', name: 'Electrician', icon: '⚡', color: '#FF9F0A' },
  { id: 'carpenter', name: 'Carpenter', icon: '🪚', color: '#8B4513' },
  { id: 'painter', name: 'Painter', icon: '🎨', color: '#FF3B30' },
  { id: 'cleaner', name: 'Cleaner', icon: '🧹', color: '#34C759' },
  { id: 'gardener', name: 'Gardener', icon: '🌱', color: '#30D158' },
  { id: 'mover', name: 'Mover', icon: '📦', color: '#5856D6' },
  { id: 'ac_technician', name: 'AC Technician', icon: '❄️', color: '#32ADE6' },
  { id: 'appliance', name: 'Appliance Repair', icon: '🔌', color: '#FF6B35' },
  { id: 'mason', name: 'Mason', icon: '🧱', color: '#8E8E93' },
  { id: 'security', name: 'Security', icon: '🔒', color: '#1D1D1F' },
  { id: 'driver', name: 'Driver', icon: '🚗', color: '#007AFF' },
];

export const INDIAN_CITIES = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune',
  'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore',
  'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara',
  'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot',
  'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar', 'Navi Mumbai',
  'Allahabad', 'Ranchi', 'Haora', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada'
];

export const LANGUAGES = [
  { id: 'english', name: 'English', script: 'English', flag: '🇬🇧' },
  { id: 'hindi', name: 'Hindi', script: 'हिंदी', flag: '🇮🇳' },
  { id: 'tamil', name: 'Tamil', script: 'தமிழ்', flag: '🏴' },
  { id: 'telugu', name: 'Telugu', script: 'తెలుగు', flag: '🏴' },
  { id: 'kannada', name: 'Kannada', script: 'ಕನ್ನಡ', flag: '🏴' },
];
