import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Production CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://serviconnect-seven.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow if no origin (e.g. mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    const isAllowedOrigin = allowedOrigins.includes(origin);
    
    if (isAllowedOrigin || (process.env.NODE_ENV !== 'production' && isLocalhost)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Render Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    supabaseConnected: !!supabase
  });
});

// Initialize Supabase Client (Service Role)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'serviconnect-storage';

let supabase;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('⚡ Connected to Supabase Storage API Gateway');
} else {
  console.error('❌ Supabase configuration missing! Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
}

// Keep the uploads folder static endpoint for legacy local uploads if they exist in DB
import fs from 'fs';
const uploadsPath = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath));
}

// Multer configured for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Validate image types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and WEBP are allowed.'));
    }
  }
});

// Helper: Sanitize folder/file names to prevent invalid URLs
const sanitizeName = (name) => {
  if (!name) return 'anonymous';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').trim();
};

// Helper: Extract relative path from a Supabase URL to allow deletion
const getPathFromUrl = (url) => {
  if (!url) return null;
  const marker = `public/${BUCKET_NAME}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.substring(index + marker.length));
};

// Route: Upload Customer Profile Photo
app.post('/api/upload/profile/customer', upload.single('image'), async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Client passes name in req.body
    const customerName = sanitizeName(req.body.name || 'customer');
    const ext = path.extname(req.file.originalname) || '.jpg';
    
    // Structure: customers/{customerName}/profile/profile-image.jpg
    const filePath = `customers/${customerName}/profile/profile-image${ext}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    res.json({ url: publicUrl });
  } catch (err) {
    console.error('Customer Avatar Upload Error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Route: Upload Worker Profile Photo
app.post('/api/upload/profile/worker', upload.single('image'), async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workerName = sanitizeName(req.body.name || 'worker');
    const ext = path.extname(req.file.originalname) || '.jpg';
    
    // Structure: workers/{workerName}/profile/profile-image.jpg
    const filePath = `workers/${workerName}/profile/profile-image${ext}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    res.json({ url: publicUrl });
  } catch (err) {
    console.error('Worker Avatar Upload Error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Route: Upload Admin Profile Photo
app.post('/api/upload/profile/admin', upload.single('image'), async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const adminName = sanitizeName(req.body.name || 'admin');
    const ext = path.extname(req.file.originalname) || '.jpg';
    
    const filePath = `admin/${adminName}/profile/profile-image${ext}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    res.json({ url: publicUrl });
  } catch (err) {
    console.error('Admin Avatar Upload Error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Route: Upload Multiple Worker Portfolio Photos (Up to 10)
app.post('/api/upload/work-photos', upload.array('images', 10), async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const workerName = sanitizeName(req.body.name || 'worker');
    const urls = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname) || '.jpg';
      const cleanOriginalName = file.originalname.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const uniqueName = `${Date.now()}-${cleanOriginalName}${ext}`;
      
      // Structure: workers/{workerName}/work-photos/{uniqueName}
      const filePath = `workers/${workerName}/work-photos/${uniqueName}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      urls.push(publicUrl);
    }

    res.json({ urls });
  } catch (err) {
    console.error('Work Photos Upload Error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Route: Upload Multiple Review Images (Up to 3)
app.post('/api/upload/review-images', upload.array('images', 3), async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const urls = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname) || '.jpg';
      const cleanOriginalName = file.originalname.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const uniqueName = `${Date.now()}-${cleanOriginalName}${ext}`;
      
      const filePath = `reviews/${uniqueName}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      urls.push(publicUrl);
    }

    res.json({ urls });
  } catch (err) {
    console.error('Review Images Upload Error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Route: Delete Individual File from Supabase Storage
app.post('/api/upload/delete-photo', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized' });
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'No image URL provided for deletion' });

    const filePath = getPathFromUrl(url);
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid Supabase image URL format' });
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) throw error;

    res.json({ success: true, message: `Successfully deleted ${filePath}` });
  } catch (err) {
    console.error('Delete Photo Error:', err);
    res.status(500).json({ error: err.message || 'Deletion failed' });
  }
});

// Handle Multer upload errors gracefully
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum limit is 5 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`🚀 Supabase Storage API Gateway running on port ${PORT}`);
});
