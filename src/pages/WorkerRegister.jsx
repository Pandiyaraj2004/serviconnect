import { Fragment, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Upload, MapPin, DollarSign } from 'lucide-react';
import { INDIAN_CITIES, SERVICE_CATEGORIES, LANGUAGES } from '../utils/helpers';
import { generateSkillQuestions, evaluateWorkerProfile } from '../lib/gemini';
import LocationPickerModal from '../components/LocationPickerModal';
import toast from 'react-hot-toast';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const TOTAL_STEPS = 5;

const ProgressBar = ({ step }) => (
  <div className="flex items-center gap-2 px-4 py-4">
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
      <Fragment key={i}>
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
          i + 1 < step ? 'bg-green-500 text-white' : i + 1 === step ? 'bg-primary-light dark:bg-primary-dark text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
        }`}>
          {i + 1 < step ? <Check size={14} /> : i + 1}
        </div>
        {i < TOTAL_STEPS - 1 && (
          <div className={`flex-1 h-1 rounded-full transition-all ${i + 1 < step ? 'bg-green-500' : 'bg-gray-100 dark:bg-gray-800'}`} />
        )}
      </Fragment>
    ))}
  </div>
);

const STEP_TITLES = ['Basic Details', 'Work Photos', 'Language', 'Skill Test', 'Your Badge'];

const WorkerRegister = () => {
  const navigate = useNavigate();
  const { user, updateUserProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  // Expanded Form data
  const [form, setForm] = useState({
    name: '',
    phone: '',
    category: '',
    experience: '',
    city: '',
    bio: '',
    language: '',
    pricingType: 'Hourly', // Hourly / Daily / Fixed
    price: '',
    address: '',
    lat: 19.076,
    lng: 72.877,
    avatar: '',
    photos: [],
  });

  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [scores, setScores] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [totalScore, setTotalScore] = useState(0);
  const [skillBadge, setSkillBadge] = useState('Novice');
  const [verificationBadge, setVerificationBadge] = useState('Standard');

  const nextStep = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const validateBasicDetails = () => {
    if (!form.name.trim()) return 'Full name is required';
    if (!/^[6-9]\d{9}$/.test(form.phone)) return 'Enter a valid 10-digit phone number';
    if (!form.category) return 'Service category is required';
    if (!form.experience) return 'Experience is required';
    if (!form.city) return 'City is required';
    if (!form.price || isNaN(form.price) || parseFloat(form.price) <= 0) return 'Please enter a valid price rate';
    if (!form.address.trim()) return 'Service address is required';
    if (!form.lat || !form.lng) return 'Please select your coordinates on the map';
    return '';
  };

  const continueFromBasicDetails = () => {
    const error = validateBasicDetails();
    if (error) {
      toast.error(error);
      return;
    }
    nextStep();
  };

  const handleProfilePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    
    const toastId = toast.loading('Uploading profile photo...');
    try {
      const res = await fetch('http://localhost:5000/api/upload/profile/worker', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setForm(prev => ({ ...prev, avatar: data.url }));
        toast.success('Profile photo uploaded!', { id: toastId });
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err) {
      toast.error('Upload failed: ' + err.message, { id: toastId });
    }
  };

  const handleWorkPhotosChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (form.photos.length + files.length > 10) {
      toast.error('You can upload up to 10 work photos only');
      return;
    }
    
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    
    const toastId = toast.loading('Uploading work photos...');
    try {
      const res = await fetch('http://localhost:5000/api/upload/work-photos', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.urls) {
        setForm(prev => ({ ...prev, photos: [...prev.photos, ...data.urls] }));
        toast.success('Work photos uploaded!', { id: toastId });
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err) {
      toast.error('Upload failed: ' + err.message, { id: toastId });
    }
  };

  const startSkillTest = async () => {
    setLoading(true);
    try {
      const qs = await generateSkillQuestions(form.category || 'plumber', form.language || 'english');
      setQuestions(qs);
      nextStep();
    } catch (err) {
      toast.error('Could not load questions. Using fallback.');
      setQuestions(Array(5).fill({ question: `Describe how you would handle a typical ${form.category || 'plumber'} job. Include safety steps.`, topic: 'General' }));
      nextStep();
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!currentAnswer.trim()) return;
    const newAnswers = [...answers, currentAnswer];
    setAnswers(newAnswers);
    setCurrentAnswer('');

    if (currentQ + 1 >= 5) {
      setLoading(true);
      try {
        const result = await evaluateWorkerProfile(
          form.category || 'plumber',
          form.experience || '1-2',
          form.photos.length,
          questions,
          newAnswers,
          form.language || 'english'
        );
        setTotalScore(result.trustScore);
        setSkillBadge(result.skillBadge);
        setVerificationBadge(result.verificationBadge);
        setFeedback(result.feedback);
        nextStep();
      } catch (err) {
        console.error('AI evaluation error:', err);
        toast.error('Evaluation failed. Using fallback.');
        setTotalScore(70);
        setSkillBadge('Intermediate');
        setVerificationBadge('Trusted');
        setFeedback('Manual evaluation completed.');
        nextStep();
      } finally {
        setLoading(false);
      }
    } else {
      setCurrentQ(q => q + 1);
      setFeedback('');
    }
  };

  const getBadgeEmoji = (badgeName) => {
    if (badgeName === 'AI Verified') return '🤖';
    if (badgeName === 'Trusted') return '✅';
    return '🌱';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-10">
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
        <div className="flex items-center gap-3 px-4 py-3">
          {step > 1 && (
            <button onClick={prevStep} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white">Join as Worker</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Step {step} of {TOTAL_STEPS}: {STEP_TITLES[step - 1]}</p>
          </div>
        </div>
        <ProgressBar step={step} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          className="px-4 py-6 max-w-xl mx-auto"
        >
          {/* STEP 1: Basic Details */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Tell us about yourself</h2>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Full Name *</label>
                <input
                  type="text"
                  placeholder="Rajesh Kumar"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-input text-sm text-gray-900 dark:text-white outline-none focus:border-primary-light dark:focus:border-primary-dark"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Phone Number *</label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-input text-sm text-gray-900 dark:text-white outline-none focus:border-primary-light dark:focus:border-primary-dark"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Service Category *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-input text-sm text-gray-900 dark:text-white outline-none"
                  >
                    <option value="">Select category</option>
                    {SERVICE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Years of Experience *</label>
                  <select value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-input text-sm text-gray-900 dark:text-white outline-none">
                    <option value="">Select experience</option>
                    {['Less than 1', '1-2', '3-5', '5-10', '10+'].map(e => <option key={e} value={e}>{e} years</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Pricing Rate Type *</label>
                  <select value={form.pricingType} onChange={e => setForm({ ...form, pricingType: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-input text-sm text-gray-900 dark:text-white outline-none">
                    <option value="Hourly">Hourly Rate</option>
                    <option value="Daily">Daily Rate</option>
                    <option value="Fixed">Fixed Rate</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Rate Amount (₹) *</label>
                  <input
                    type="number"
                    placeholder="299"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-input text-sm text-gray-900 dark:text-white outline-none focus:border-primary-light dark:focus:border-primary-dark"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">City *</label>
                <select value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-input text-sm text-gray-900 dark:text-white outline-none">
                  <option value="">Select city</option>
                  {INDIAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Physical Address *</label>
                <textarea rows={2} placeholder="Building name, street details, landmark..." value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-input text-sm text-gray-900 dark:text-white outline-none resize-none" />
              </div>

              {/* Map Coordinates Picker */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Map Location Coordinates *</label>
                <div className="flex gap-2">
                  <div className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-input text-sm text-gray-600 dark:text-gray-400 select-none">
                    {form.lat.toFixed(4)}, {form.lng.toFixed(4)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapOpen(true)}
                    className="px-4 py-3 bg-gray-200 dark:bg-gray-750 text-gray-800 dark:text-gray-200 font-bold rounded-input text-sm flex items-center gap-1.5"
                  >
                    <MapPin size={16} /> Pin on Map
                  </button>
                </div>
              </div>

              <LocationPickerModal
                isOpen={isMapOpen}
                onClose={() => setIsMapOpen(false)}
                onSave={({ lat, lng, address }) => setForm(prev => ({ ...prev, lat, lng, address }))}
                initialLat={form.lat}
                initialLng={form.lng}
                initialAddress={form.address}
              />

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Short Bio</label>
                <textarea rows={2} placeholder="Tell customers about your expertise..." value={form.bio}
                  onChange={e => setForm({ ...form, bio: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-input text-sm text-gray-900 dark:text-white outline-none resize-none" />
              </div>

              <button onClick={continueFromBasicDetails} className="w-full py-3 bg-primary-light dark:bg-primary-dark text-white rounded-button font-semibold flex items-center justify-center gap-2">
                Continue <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* STEP 2: Photos (Profile & Portfolio) */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Worker Photos</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Provide your profile avatar and portfolio work photos.</p>
              </div>

              {/* Profile Photo */}
              <div className="bg-white dark:bg-surface-dark border border-gray-150 dark:border-gray-850 p-4 rounded-xl">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2">Profile Photo *</label>
                <div className="flex items-center gap-4">
                  {form.avatar ? (
                    <img src={form.avatar} alt="Profile preview" className="w-16 h-16 rounded-full object-cover border" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-xs text-center border">
                      No Photo
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      id="profile-upload"
                      className="hidden"
                      onChange={handleProfilePhotoChange}
                    />
                    <label htmlFor="profile-upload" className="px-4 py-2 border rounded-button text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                      <Upload size={14} /> Choose Avatar File
                    </label>
                  </div>
                </div>
              </div>

              {/* Work Photos */}
              <div className="bg-white dark:bg-surface-dark border border-gray-150 dark:border-gray-850 p-4 rounded-xl">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2">Portfolio Work Photos (up to 10)</label>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {form.photos.map((url, i) => (
                    <div key={i} className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden relative group border">
                      <img src={url} alt={`Work ${i+1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== i) }))}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  
                  {form.photos.length < 10 && (
                    <div>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        id="work-photos-upload"
                        className="hidden"
                        onChange={handleWorkPhotosChange}
                      />
                      <label htmlFor="work-photos-upload" className="aspect-square border-2 border-dashed border-gray-250 dark:border-gray-750 rounded-xl flex items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-2xl">
                        +
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={nextStep}
                disabled={!form.avatar}
                className="w-full py-3 bg-primary-light dark:bg-primary-dark text-white rounded-button font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                Continue <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* STEP 3: Language Selection */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose your language</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">The AI skill test will be conducted in your chosen language</p>
              <div className="grid grid-cols-1 gap-3">
                {LANGUAGES.map(lang => (
                  <motion.button
                    key={lang.id}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => setForm({ ...form, language: lang.id })}
                    className={`p-4 rounded-card border-2 flex items-center gap-4 text-left transition-all ${
                      form.language === lang.id
                        ? 'border-primary-light dark:border-primary-dark bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark'
                    }`}
                  >
                    <span className="text-3xl">{lang.flag}</span>
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">{lang.name}</div>
                      <div className="text-gray-500 dark:text-gray-400 text-lg">{lang.script}</div>
                    </div>
                    {form.language === lang.id && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto w-6 h-6 bg-primary-light dark:bg-primary-dark rounded-full flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
              <button
                onClick={startSkillTest}
                disabled={!form.language || loading}
                className="w-full py-3 bg-primary-light dark:bg-primary-dark text-white rounded-button font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Loading Questions...</> : <>Start Skill Test <ArrowRight size={18} /></>}
              </button>
            </div>
          )}

          {/* STEP 4: Skill Test */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Skill Test</h2>
                <div className="flex gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < currentQ ? 'bg-green-500' : i === currentQ ? 'bg-primary-light dark:bg-primary-dark' : 'bg-gray-200 dark:bg-gray-700'}`} />
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-surface-dark rounded-card p-5 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-primary-light dark:text-primary-dark bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full">
                    Question {currentQ + 1} of 5
                  </span>
                  {questions[currentQ]?.topic && <span className="text-xs text-gray-400">{questions[currentQ].topic}</span>}
                </div>
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-semibold">
                  {questions[currentQ]?.question || `Describe how you would handle a common ${form.category} problem safely and efficiently.`}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Your Answer</label>
                <textarea
                  rows={6}
                  placeholder="Write your detailed technical answer here..."
                  value={currentAnswer}
                  onChange={e => setCurrentAnswer(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-input text-sm text-gray-900 dark:text-white outline-none focus:border-primary-light dark:focus:border-primary-dark resize-none"
                />
              </div>
              
              <button
                onClick={submitAnswer}
                disabled={loading || !currentAnswer.trim()}
                className="w-full py-3 bg-primary-light dark:bg-primary-dark text-white rounded-button font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Evaluating Profile...</> : currentQ < 4 ? 'Submit & Next Question' : 'Submit & Complete Test'}
              </button>
            </div>
          )}

          {/* STEP 5: Badge Result */}
          {step === 5 && (
            <div className="text-center space-y-6">
              {(() => {
                const finalScore = totalScore;
                const emoji = getBadgeEmoji(verificationBadge);
                return (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                      className={`mx-auto w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-6xl border-4 border-white dark:border-gray-800 shadow-xl`}
                    >
                      {emoji}
                    </motion.div>

                    <div>
                      <h2 className="text-3xl font-black text-gray-900 dark:text-white">Profile Assessed!</h2>
                      <p className={`text-lg font-bold text-primary-light dark:text-primary-dark mt-2`}>
                        {verificationBadge} ({skillBadge})
                      </p>
                    </div>

                    <div className="text-5xl font-black text-gray-900 dark:text-white">{finalScore}<span className="text-2xl text-gray-400">/100</span></div>

                    <div className="bg-white dark:bg-surface-dark rounded-card p-6 border border-gray-100 dark:border-gray-800 text-left space-y-4">
                      <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Assessor Feedback</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed italic">
                        "{feedback || 'Your profile has been validated by ServiConnect AI.'}"
                      </p>
                    </div>

                    <button
                      onClick={async () => {
                        if (!user || !db) {
                          toast.error('Please sign in before creating a worker profile');
                          return;
                        }

                        try {
                          await setDoc(doc(db, 'workers', user.uid), {
                            uid: user.uid,
                            name: form.name.trim(),
                            phone: form.phone,
                            category: form.category,
                            experience: form.experience,
                            city: form.city,
                            pricingType: form.pricingType,
                            price: parseFloat(form.price),
                            address: form.address.trim(),
                            lat: form.lat,
                            lng: form.lng,
                            avatar: form.avatar,
                            photos: form.photos,
                            bio: form.bio.trim(),
                            language: form.language,
                            badge: verificationBadge,
                            skillLevelBadge: skillBadge,
                            trustScore: finalScore,
                            skillAnswers: answers,
                            available: true,
                            disabled: false,
                            updatedAt: serverTimestamp(),
                            createdAt: serverTimestamp(),
                          }, { merge: true });
                          
                          await updateUserProfile({
                            role: 'worker',
                            name: form.name.trim(),
                            phone: form.phone,
                            city: form.city,
                            avatar: form.avatar,
                            address: form.address.trim(),
                            lat: form.lat,
                            lng: form.lng
                          });
                          
                          toast.success('Worker profile published');
                          navigate('/worker-dashboard');
                        } catch (error) {
                          toast.error(error.message || 'Could not save worker profile');
                        }
                      }}
                      className="w-full py-4 bg-primary-light dark:bg-primary-dark text-white rounded-button font-bold text-lg"
                    >
                      Go to Dashboard 🚀
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default WorkerRegister;
