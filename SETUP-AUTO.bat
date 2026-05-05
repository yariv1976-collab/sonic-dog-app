@echo off
chcp 65001 >nul
echo.
echo  ╔══════════════════════════════════════╗
echo  ║   סוניק 🐕 - הגדרה אוטומטית         ║
echo  ╚══════════════════════════════════════╝
echo.

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
  echo  ❌ Git לא מותקן!
  echo  הורד מ: https://git-scm.com/download/win
  echo  לאחר ההתקנה הרץ סקריפט זה מחדש
  pause
  exit /b 1
)

echo  ✅ Git מותקן
echo.

REM Check node
node --version >nul 2>&1
if errorlevel 1 (
  echo  ❌ Node.js לא מותקן!
  pause
  exit /b 1
)
echo  ✅ Node.js מותקן
echo.

REM Install npm packages
echo  📦 מתקין חבילות...
call npm install
if errorlevel 1 (
  echo  ❌ שגיאה בהתקנת חבילות
  pause
  exit /b 1
)
echo  ✅ חבילות הותקנו
echo.

REM Create icons
echo  🎨 יוצר אייקונים...
node create-icons.js
echo.

REM Git setup
echo  📤 מעלה ל-GitHub...
git init
git add .
git commit -m "Sonic dog app initial commit"
git branch -M main
git remote add origin https://github.com/yariv1976-collab/sonic-dog-app.git
git push -u origin main

if errorlevel 1 (
  echo.
  echo  ⚠️  אם GitHub מבקש סיסמה:
  echo  - שם משתמש: yariv1976-collab
  echo  - סיסמה: השתמש ב-Personal Access Token
  echo    github.com/settings/tokens - Generate new token - repo
  echo.
  pause
  exit /b 1
)

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  ✅ הקוד הועלה בהצלחה ל-GitHub!                    ║
echo  ║                                                      ║
echo  ║  עכשיו עבור ל-Render:                               ║
echo  ║  https://dashboard.render.com/new/web               ║
echo  ║                                                      ║
echo  ║  הגדרות ב-Render:                                   ║
echo  ║  • Repository: sonic-dog-app                        ║
echo  ║  • Build Command: npm install                       ║
echo  ║  • Start Command: npm start                         ║
echo  ║                                                      ║
echo  ║  משתני סביבה להוסיף:                                ║
echo  ║  VAPID_PUBLIC  = ^(ראה למטה^)                        ║
echo  ║  VAPID_PRIVATE = ^(ראה למטה^)                        ║
echo  ║  VAPID_EMAIL   = mailto:your@email.com              ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  🔑 המפתחות שלך ^(שמור אותם!^):
echo.
echo  VAPID_PUBLIC=Tp6THk3_-M5rhws9TQS3KlzTAJhmOoLCPrXUJcbN4386Cyh6arZEA_ke5zOzjERpKvCbOtNx_tNRI-Xc-QT2kg
echo  VAPID_PRIVATE=BzZX-iwg0lTx5R0UjMjlEF44XEqmDRPsAGYR7uhRi_w
echo.
pause
