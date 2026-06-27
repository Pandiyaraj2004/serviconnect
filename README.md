# 🔧 ServiConnect

> AI-powered local service worker finder, verifier, and booking platform — built for smaller Indian cities underserved by platforms like Urban Company.

Customers can search, verify, and book independent freelance workers (plumbers, electricians, carpenters, etc.) directly. Workers are AI-verified via Gemini skill tests. Real-time chat is powered by Firebase Realtime Database. Profile photos, work photos, and review images are stored locally using a Node/Express backend.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Firebase Setup (Required)](#-firebase-setup-required)
- [Gemini AI Setup (Optional)](#-gemini-ai-setup-optional)
- [Environment Variables](#-environment-variables)
- [Firebase Database Rules](#-firebase-database-rules)
- [Project Structure](#-project-structure)
- [Testing Guidelines](#-testing-guidelines)
- [Deployment](#-deployment)

---

## ✨ Features

- 🔍 **Search & Filter Workers** — by category, city, distance, rating, and experience.
- 🤖 **AI Skill Verification** — Gemini AI generates 5 unique scenario-based questions in the worker's selected language and evaluates them realistically alongside work history.
- 📅 **Interactive Booking System** — date/time selection, problem description, map picker preview, and real-time accept/decline worker actions.
- 💬 **Real-time Chat** — Firebase Realtime Database powered chat between customer and worker, with phone number privacy protection.
- 📲 **WhatsApp Notifications** — automatic booking confirmations and OTP delivery notifications.
- ✅ **Job Completion OTP** — 4-digit OTP flow for worker/customer job completion verification and worker reactivation.
- ⭐ **Reviews & Ratings** — post-job review system saved permanently to Firestore.
- 👑 **Admin Console** — statistics tracking, user management, chat inspector, and worker removal system.
- 📂 **Local Image Storage** — Node.js + Express upload APIs using Multer (replacing Firebase Storage).

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5 |
| Backend | Node.js, Express, Multer (Local storage) |
| Styling | Tailwind CSS v3 |
| Animations | Framer Motion |
| Routing | React Router v6 |
| Auth | Firebase Authentication (Email + Google) |
| Database | Firebase Firestore (bookings, users, workers) |
| Realtime | Firebase Realtime Database (chat) |
| AI | Google Gemini 1.5 Flash |
| Maps | React Leaflet + OpenStreetMap |
| Toast | react-hot-toast |

---

## 📦 Prerequisites

Before you begin, make sure you have:

- **Node.js** v18 or higher → [nodejs.org](https://nodejs.org)
- **npm** v9 or higher (comes with Node.js)
- A **Firebase account** → [firebase.google.com](https://firebase.google.com) (free tier is sufficient)
- A **Google AI Studio account** for Gemini API → [aistudio.google.com](https://aistudio.google.com) (optional — app fallback questions are available)

Check your versions:
```bash
node --version   # Should be v18+
npm --version    # Should be v9+
```

---

## 🚀 Quick Start

### Step 1: Install Dependencies
```bash
# Clone or extract the project
cd servi-connect

# Install package dependencies
npm install
```

### Step 2: Set Up Environment Variables
Create a `.env` file in the project root:
```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=1:your_sender_id:web:your_app_id

# Firebase Realtime Database (URL for Chat)
VITE_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com/

# Google Gemini AI API Key
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### Step 3: Run the Full-Stack Application
To test the application, you must run both the Vite frontend server and the Express upload server in parallel.

**Terminal 1 (Vite Frontend):**
```bash
npm run dev
# App opens at http://localhost:5173
```

**Terminal 2 (Express Upload Server):**
```bash
npm run server
# Upload APIs started on http://localhost:5000
```

---

## 🔥 Firebase Setup (Required)

Ensure the following rules are set:

### Firestore Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
    match /bookings/{bookingId} {
      allow create: if request.auth != null;
      allow read, write, update: if request.auth != null;
    }
    match /workers/{workerId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Realtime Database Rules
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

---

## 🧪 Testing Guidelines

Test the entire system end-to-end using the three roles:

### 1. Customer Verification
- Register an account at `/register` as a customer.
- Pinned your location coordinates using the map button in the header.
- Browse services and search for workers. Note that search results are sorted dynamically based on your pinned location.
- Book a worker by selecting a date, time slot, and submitting a booking.

### 2. Worker Verification
- Log in and register as a worker at `/worker-register`.
- Enter basic details, select pricing, and upload your profile and work photos (stored in local directories).
- Select a language (e.g. Hindi, Tamil) and complete the 5 scenario questions generated by Gemini.
- Submit the test and view your trust score evaluation. Open the **Worker Dashboard**.
- Accept the pending booking request.

### 3. Chat & Completion OTP Flow
- Open the chat room. You can chat in real time. Contact details are hidden until the booking is confirmed.
- Worker clicks **Complete Work**. This triggers OTP generation and sends a WhatsApp message.
- Customer reads the OTP from their bookings panel and shares it with the worker.
- Worker enters the OTP code. The job is marked as `completed` and the worker's availability is reactivated.
- Customer leaves a review.

### 4. Administrative Controls
- Log in using `username: pandi` and `password: pandi`.
- Check live metrics on the Overview dashboard.
- Inspect the conversations under **Chats Inspector** (reads logs directly from RTDB).
- Select a worker and click **Remove**. Enter the reason to disable their profile. Try accessing the dashboard using that worker's credentials to confirm the warning message.
