Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      ServiConnect - Firebase Rules Auto-Setup            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will open Firebase Console in your browser." -ForegroundColor Yellow
Write-Host "You just need to paste the rules and click Publish." -ForegroundColor Yellow
Write-Host ""

# Copy rules to clipboard
$rules = @"
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow write: if true;
    }
    match /workers/{workerId} {
      allow read: if true;
      allow write: if true;
    }
    match /bookings/{bookingId} {
      allow read: if true;
      allow write: if true;
    }
    match /chats/{chatId} {
      allow read: if true;
      allow write: if true;
    }
    match /reviews/{reviewId} {
      allow read: if true;
      allow write: if true;
    }
    match /notifications/{notifId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
"@

$rules | Set-Clipboard
Write-Host "✅ Rules COPIED to your clipboard!" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
Write-Host "STEP-BY-STEP INSTRUCTIONS:" -ForegroundColor White
Write-Host ""
Write-Host "1. Your browser will open to Firebase Firestore Rules page" -ForegroundColor White
Write-Host "2. Log in with your Google account if asked" -ForegroundColor White
Write-Host "3. Click inside the code editor (the dark area with rules)" -ForegroundColor White
Write-Host "4. Press Ctrl+A to select ALL existing rules" -ForegroundColor White
Write-Host "5. Press Ctrl+V to PASTE the new rules (already in clipboard!)" -ForegroundColor White
Write-Host "6. Click the blue 'Publish' button" -ForegroundColor White
Write-Host "7. Wait for 'Rules published' confirmation" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""

# Also do RTDB rules
$rtdbRules = '{"rules":{".read":true,".write":true}}'
Write-Host "ALSO DO RTDB RULES:" -ForegroundColor Yellow
Write-Host "1. After Firestore rules, go to Realtime Database Rules" -ForegroundColor White
Write-Host "   URL: https://console.firebase.google.com/project/serviconnect-2bb43/database/serviconnect-2bb43-default-rtdb/rules" -ForegroundColor DarkGray
Write-Host "2. Replace ALL content with: " -ForegroundColor White
Write-Host '   {"rules":{".read":true,".write":true}}' -ForegroundColor Green
Write-Host "3. Click Publish" -ForegroundColor White
Write-Host ""

# Open the browser
Write-Host "Opening Firebase Console now..." -ForegroundColor Cyan
Start-Process "https://console.firebase.google.com/project/serviconnect-2bb43/firestore/rules"

Write-Host ""
Write-Host "Press any key after you've published the rules..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "✅ Done! Now refresh your ServiConnect app (http://localhost:5173)" -ForegroundColor Green
Write-Host "   The admin panel should now fully work!" -ForegroundColor Green
Write-Host ""
