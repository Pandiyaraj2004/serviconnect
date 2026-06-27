import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Helper to guarantee directories exist
const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Storage rules config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subDir = 'uploads/';
    const url = req.originalUrl;
    
    if (url.includes('/profile/customer')) {
      subDir = 'uploads/profiles/customers/';
    } else if (url.includes('/profile/worker')) {
      subDir = 'uploads/profiles/workers/';
    } else if (url.includes('/profile/admin')) {
      subDir = 'uploads/profiles/admins/';
    } else if (url.includes('/work-photos')) {
      subDir = 'uploads/work-photos/';
    } else if (url.includes('/review-images')) {
      subDir = 'uploads/reviews/';
    }
    
    const targetPath = path.join(__dirname, subDir);
    ensureDirExists(targetPath);
    cb(null, targetPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Profile Upload routes
app.post('/api/upload/profile/customer', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `http://localhost:${PORT}/uploads/profiles/customers/${req.file.filename}`;
  res.json({ url: fileUrl });
});

app.post('/api/upload/profile/worker', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `http://localhost:${PORT}/uploads/profiles/workers/${req.file.filename}`;
  res.json({ url: fileUrl });
});

app.post('/api/upload/profile/admin', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `http://localhost:${PORT}/uploads/profiles/admins/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Work Photos (Up to 10)
app.post('/api/upload/work-photos', upload.array('images', 10), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  const urls = req.files.map(file => `http://localhost:${PORT}/uploads/work-photos/${file.filename}`);
  res.json({ urls });
});

// Review Images (Up to 3)
app.post('/api/upload/review-images', upload.array('images', 3), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  const urls = req.files.map(file => `http://localhost:${PORT}/uploads/reviews/${file.filename}`);
  res.json({ urls });
});

app.listen(PORT, () => {
  console.log(`🚀 Image Upload Server running on http://localhost:${PORT}`);
});
