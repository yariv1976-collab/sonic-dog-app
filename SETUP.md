# 🐕 סוניק — הוראות התקנה מלאות

## מה תצטרך
- [Node.js](https://nodejs.org) — כבר מותקן ✅
- [Git](https://git-scm.com) — להורדה אם לא מותקן
- חשבון [GitHub](https://github.com) — חינם
- חשבון [Render](https://render.com) — חינם (הרשמה עם Google)

---

## שלב 1 — הכן את הפרויקט

פתח Terminal / Command Prompt בתיקיית הפרויקט:

```bash
cd sonic-app
npm install
node create-icons.js
```

---

## שלב 2 — צור מפתחות VAPID (פעם אחת בלבד!)

```bash
npm run generate-keys
```

תקבל פלט כזה — **שמור אותו!**
```
VAPID_PUBLIC=BExamplePublicKeyHere...
VAPID_PRIVATE=ExamplePrivateKeyHere...
```

---

## שלב 3 — העלה ל-GitHub

1. פתח [github.com](https://github.com) → New repository
2. שם: `sonic-dog-app` → Create
3. בטרמינל:

```bash
git init
git add .
git commit -m "Sonic dog app"
git remote add origin https://github.com/YOUR_USERNAME/sonic-dog-app.git
git push -u origin main
```

---

## שלב 4 — פרוס ב-Render

1. היכנס ל-[render.com](https://render.com)
2. **New → Web Service**
3. חבר את ה-GitHub repo שיצרת
4. הגדרות:
   - **Name:** sonic-dog-app
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. לחץ **Advanced** → **Add Environment Variable** והוסף:
   ```
   VAPID_PUBLIC   = [המפתח הציבורי מהשלב הקודם]
   VAPID_PRIVATE  = [המפתח הפרטי מהשלב הקודם]
   VAPID_EMAIL    = mailto:YOUR_EMAIL@gmail.com
   ```
6. לחץ **Create Web Service**

אחרי כמה דקות תקבל כתובת כמו: `https://sonic-dog-app.onrender.com`

---

## שלב 5 — התקן על הנייד

### אייפון (Safari בלבד!):
1. פתח Safari → `https://sonic-dog-app.onrender.com`
2. לחץ על כפתור השיתוף ⬆️
3. **"הוסף למסך הבית"** → הוסף
4. האפליקציה תופיע כאייקון על המסך

### אנדרואיד (Chrome):
1. פתח Chrome → `https://sonic-dog-app.onrender.com`
2. יופיע באנר **"הוסף למסך הבית"** — לחץ עליו
3. או: תפריט ⋮ → **"הוסף למסך הבית"**

---

## שלב 6 — הגדר התראות

בכל נייד:
1. פתח את האפליקציה
2. בלשונית **"היום"** — בחר מי אתה
3. לחץ **"🔔 הפעל התראות"** ואשר
4. עבור להגדרות ← בדיקת התראה ← **"שלח"** כדי לאמת שעובד

---

## הערות חשובות

- **Render חינמי**: השרת "נרדם" אחרי 15 דקות ללא שימוש ← ייתכן עיכוב של ~30 שניות בפתיחה ראשונה
- **לשדרג ל-Render Starter ($7/חודש)**: השרת תמיד ער — מומלץ לשימוש יומי
- **אייפון**: התראות Push דורשות iOS 16.4+ ו-Safari
- **ה-subscriptions.json** נשמר על השרת — אם Render מאפס, כולם צריכים לרשום מחדש (זה נדיר)

---

## בעיות נפוצות

**"לא מקבל התראות"**
- ודא שבחרת מי אתה לפני הפעלת התראות
- בדוק הגדרות נייד → התראות → סוניק → אפשר

**"האפליקציה לא נטענת"**
- Render בחינם מתאפס — המתן 30 שניות ורענן

**"ההחלפה לא נשמרת לאחרים"**
- לרענן את האפליקציה בנייד של כולם לאחר החלפה
