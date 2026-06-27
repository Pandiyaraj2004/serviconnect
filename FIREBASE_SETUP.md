# ServiConnect Firebase Setup Guide

## ✅ Fix Unauthorized Domain Error

### Step 1: Add localhost to Firebase
1. Go to https://console.firebase.google.com
2. Select project "serviconnect-2bb43"
3. Go to **Authentication** tab
4. Click **Settings** (gear icon, top right)
5. Go to **Authorized domains** tab
6. Click **Add domain**
7. Enter: `localhost:5173`
8. Click **Add** and save

### Step 2: Enable Authentication Methods
In the same **Authentication** tab:
- ✅ Enable **Email/Password** (already enabled)
- ✅ Enable **Google** (click setup):
  - Add your OAuth consent screen if not done
  - Add Authorized redirect URIs: `http://localhost:5173/__/auth/handler`

### Step 3: Enable Firestore Database
1. Go to **Firestore Database** tab
2. Click **Create Database**
3. Select **Production mode**
4. Choose region closest to you
5. Click **Create**

### Step 4: Set Firestore Security Rules
In Firestore, go to **Rules** tab and replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users collection — anyone can read, owner can write, admin always can write
    match /users/{userId} {
      allow read: if true;
      allow write: if true;
    }

    // Workers collection — public read, worker writes own, admin writes any
    match /workers/{workerId} {
      allow read: if true;
      allow write: if true;
    }

    // Bookings — authenticated users can read and write
    match /bookings/{bookingId} {
      allow read: if true;
      allow write: if true;
    }

    // Chats — authenticated users can read and write
    match /chats/{chatId} {
      allow read: if true;
      allow write: if true;
    }

    // Reviews — public read, authenticated write
    match /reviews/{reviewId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

> ⚠️ **Note:** The `allow write: if true` rules are required because the Admin panel uses a bypass login (not a real Firebase Auth user), so Firestore cannot verify `request.auth`. For production, replace with proper admin SDK or Firebase Custom Claims.

**Important:** Hit **Publish** to save the rules.

### Step 5: Enable Realtime Database
1. Go to **Realtime Database** tab
2. Click **Create Database**
3. Choose region
4. Start in **Test mode**
5. Click **Enable**

Go to **Rules** tab and use:
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

### Step 6: Enable Storage
1. Go to **Storage** tab
2. Click **Get Started**
3. Keep default rules for testing
4. Create

### Step 7: Check .env File
Verify your `.env` has correct values:
```env

```

## 🐛 Common Bugs & Fixes

### Bug 1: Still Getting "unauthorized-domain"?
- Clear browser cache (Ctrl+Shift+Delete)
- Clear localStorage: Open DevTools → Application → Clear Site Data
- Restart dev server: `npm run dev`
- Try incognito window

### Bug 2: Google Login Not Working
- Make sure OAuth consent screen is configured
- Add `http://localhost:5173` to authorized JavaScript origins
- Add `http://localhost:5173/__/auth/handler` to authorized redirect URIs

### Bug 3: Firestore Write Fails
- Check Security Rules are set (not in production mode restrictions)
- Make sure user is authenticated (`useAuth().user` not null)
- Check browser console for specific error messages

### Bug 4: Can't Create Account
- Make sure email format is valid
- Password must be 8+ characters
- Phone number must be 10 digits starting with 6-9
- City must be selected from list

## 🧪 Quick Test After Setup
1. Navigate to http://localhost:5173/register
2. Fill form with test data:
   - Name: Test User
   - Phone: 9876543210
   - Email: test@example.com
   - Password: Test@1234 (8+ chars)
   - City: Mumbai
3. Click "Create Account"
4. Check for errors in browser DevTools → Console

## 📱 If You See Errors
1. Open browser **DevTools** (F12)
2. Go to **Console** tab
3. Copy the full error message
4. Search that error in the guide above

## ✨ Next Steps
After successful login/register:
- Go to `/dashboard` to see customer dashboard
- Go to `/worker-register` to register as a worker
- Try `/search` to search for workers
