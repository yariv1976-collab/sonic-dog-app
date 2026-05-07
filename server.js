const express = require('express');
const webpush = require('web-push');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ─── VAPID ────────────────────────────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || '';
const VAPID_EMAIL   = process.env.VAPID_EMAIL   || 'mailto:yariv1976@gmail.com';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const BASE_URL             = process.env.BASE_URL || 'https://sonic-dog-app.onrender.com';
const REDIRECT_URI         = BASE_URL + '/api/auth/google/callback';
const RENDER_API_KEY       = process.env.RENDER_API_KEY || '';
const RENDER_SERVICE_ID    = process.env.RENDER_SERVICE_ID || '';

function createOAuthClient() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const SUBS_FILE     = path.join(__dirname, 'subscriptions.json');
const SCHEDULE_FILE = path.join(__dirname, 'schedule.json');
const TOKENS_FILE   = path.join(__dirname, 'tokens.json');

function loadSubs()     { try { return JSON.parse(fs.readFileSync(SUBS_FILE,  'utf8')); } catch { return {}; } }
function saveSubs(d)    { fs.writeFileSync(SUBS_FILE,  JSON.stringify(d, null, 2)); }
function loadTokens()   { try { return JSON.parse(fs.readFileSync(TOKENS_FILE,'utf8')); } catch { return {}; } }
function saveTokens(d)  { fs.writeFileSync(TOKENS_FILE, JSON.stringify(d, null, 2)); }

const DEFAULT_SCHEDULE = {
  morning: ['יובל','יובל','עומר','הורים','עומר','עומר','יובל'],
  noon:    ['עומר','הורים','עומר','יובל','עומר','יובל','עומר'],
  evening: ['יובל','עומר','יובל','יובל','עומר','יובל','עומר'],
  teeth:   ['עומר','עומר','עומר','עומר','עומר','עומר','עומר'],
  sleep:   ['יובל','יובל','עומר','יובל','עומר','עומר','יובל'],
};
function loadSchedule() {
  // First try env var (permanent), then file (temporary), then default
  if (process.env.SCHEDULE_DATA) {
    try { return JSON.parse(process.env.SCHEDULE_DATA); } catch {}
  }
  try { return JSON.parse(fs.readFileSync(SCHEDULE_FILE,'utf8')); } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
}
function saveSchedule(d){
  try { fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(d, null, 2)); } catch {}
  // Note: to make permanent, update SCHEDULE_DATA env var in Render
}
let scheduleData = loadSchedule();

// ─── Constants ────────────────────────────────────────────────────────────────
const PHONES = { 'יובל':'972584997372','עומר':'972584271372','יריב':'972542271372','שירה':'972544997372' };
const TASK_LABELS = { morning:'הוצאת בוקר', noon:'הוצאת צהריים', evening:'הוצאת ערב', teeth:'צחצוח שיניים', sleep:'שינה' };
const TIMES = { morning:{h:8,m:0}, noon:{h:14,m:30}, evening:{h:20,m:0}, teeth:{h:21,m:0}, sleep:{h:22,m:0} };
const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
// Map person name to Google account email
const PERSON_EMAILS = {
  'יובל': null, // will be set when they connect
  'עומר': null,
  'יריב': null,
  'שירה': null,
};

// ─── Push helpers ─────────────────────────────────────────────────────────────
async function sendPushToPerson(personName, title, body, waUrl) {
  const subs = loadSubs();
  const personSubs = subs[personName] || [];
  const payload = JSON.stringify({ title, body, waUrl });
  for (const sub of personSubs) {
    try { await webpush.sendNotification(sub, payload); }
    catch(e) { console.error('Push failed for ' + personName + ':', e.statusCode); }
  }
}

async function sendTaskNotification(task, isReminder) {
  const dayIdx = new Date().getDay();
  const person = scheduleData[task][dayIdx];
  const label = TASK_LABELS[task];
  const t = TIMES[task];
  const timeStr = String(t.h).padStart(2,'0') + ':' + String(t.m).padStart(2,'0');
  const people = person === 'הורים' ? ['יריב','שירה'] : [person];
  for (const p of people) {
    const phone = PHONES[p];
    const msg = isReminder
      ? '🐕 תזכורת: בעוד חצי שעה (' + timeStr + ') יש ' + label + ' לסוניק!'
      : '🐕 הגיע הזמן: ' + label + ' לסוניק עכשיו (' + timeStr + ')!';
    await sendPushToPerson(p, (isReminder ? '⏰ תזכורת — ' : '🔔 ') + label, msg,
      'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg));
  }
}

// ─── Cron (UTC, Israel = UTC+3) ───────────────────────────────────────────────
cron.schedule('30 4 * * *',  () => sendTaskNotification('morning', true));
cron.schedule('0 5 * * *',   () => sendTaskNotification('morning', false));
cron.schedule('0 11 * * *',  () => sendTaskNotification('noon', true));
cron.schedule('30 11 * * *', () => sendTaskNotification('noon', false));
cron.schedule('30 16 * * *', () => sendTaskNotification('evening', true));
cron.schedule('0 17 * * *',  () => sendTaskNotification('evening', false));
cron.schedule('30 17 * * *', () => sendTaskNotification('teeth', true));
cron.schedule('0 18 * * *',  () => sendTaskNotification('teeth', false));

// ─── Google Calendar helpers ──────────────────────────────────────────────────
function getNextWeekDates() {
  // Returns array of 7 Date objects starting from this coming Sunday
  const today = new Date();
  const day = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day + (day === 0 ? 0 : 7)); // next Sunday
  sunday.setHours(0,0,0,0);
  return Array.from({length:7}, (_,i) => { const d = new Date(sunday); d.setDate(sunday.getDate()+i); return d; });
}

function makeEventTime(date, hour, min) {
  // Format as local time string to avoid UTC conversion issues
  const pad = n => String(n).padStart(2,'0');
  const y = date.getFullYear();
  const mo = pad(date.getMonth()+1);
  const d = pad(date.getDate());
  const endMin = (min + 30) % 60;
  const endHour = hour + Math.floor((min + 30) / 60);
  const startStr = y + '-' + mo + '-' + d + 'T' + pad(hour) + ':' + pad(min) + ':00';
  const endStr   = y + '-' + mo + '-' + d + 'T' + pad(endHour) + ':' + pad(endMin) + ':00';
  return {
    start: { dateTime: startStr, timeZone: 'Asia/Jerusalem' },
    end:   { dateTime: endStr,   timeZone: 'Asia/Jerusalem' },
  };
}

async function syncCalendarForPerson(personName) {
  const tokens = loadTokens();
  if (!tokens[personName]) return { error: 'not_connected' };

  const oauth2 = createOAuthClient();
  oauth2.setCredentials(tokens[personName]);
  const calendar = google.calendar({ version: 'v3', auth: oauth2 });

  const dates = getNextWeekDates();
  const tasks = ['morning','noon','evening','teeth','sleep'];
  const created = [];

  // Delete old sonic events first
  try {
    const existing = await calendar.events.list({
      calendarId: 'primary',
      q: 'סוניק',
      timeMin: dates[0].toISOString(),
      timeMax: new Date(dates[6].getTime() + 86400000).toISOString(),
      singleEvents: true,
    });
    for (const ev of (existing.data.items || [])) {
      await calendar.events.delete({ calendarId: 'primary', eventId: ev.id });
    }
  } catch(e) { console.error('Delete old events error:', e.message); }

  // Create new events for this person
  for (const task of tasks) {
    for (let i = 0; i < 7; i++) {
      const person = scheduleData[task][i];
      const people = person === 'הורים' ? ['יריב','שירה'] : [person];
      if (!people.includes(personName)) continue;

      const t = TIMES[task];
      const eventTime = makeEventTime(dates[i], t.h, t.m);
      const label = TASK_LABELS[task];
      const dayHe = DAYS_HE[i];

      await calendar.events.insert({
        calendarId: 'primary',
        resource: {
          summary: '🐕 סוניק — ' + label,
          description: 'תורנות ' + label + ' לסוניק — יום ' + dayHe,
          ...eventTime,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 30 },
            ],
          },
        },
      });
      created.push(label + ' יום ' + dayHe);
    }
  }
  return { ok: true, created };
}

// ─── Auth routes ──────────────────────────────────────────────────────────────
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state: person } = req.query;
  try {
    const oauth2 = createOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    const allTokens = loadTokens();
    allTokens[person] = tokens;
    saveTokens(allTokens);
    await syncCalendarForPerson(person);
    res.send('<html><body dir="rtl" style="font-family:sans-serif;text-align:center;padding:40px"><h2>✅ היומן חובר בהצלחה!</h2><p>התורנויות של ' + person + ' נוספו ל-Google Calendar.</p><p><a href="/">חזור לאפליקציה</a></p></body></html>');
  } catch(e) {
    console.error('OAuth callback error:', e);
    res.send('<html><body dir="rtl" style="font-family:sans-serif;text-align:center;padding:40px"><h2>❌ שגיאה</h2><p>' + e.message + '</p><a href="/">חזור</a></body></html>');
  }
});

app.get('/api/auth/google/:person', (req, res) => {
  const person = decodeURIComponent(req.params.person);
  const oauth2 = createOAuthClient();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: person,
    prompt: 'consent',
  });
  res.redirect(url);
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.post('/api/subscribe', (req, res) => {
  const { subscription, person } = req.body;
  if (!subscription || !person) return res.status(400).json({ error: 'missing fields' });
  const subs = loadSubs();
  if (!subs[person]) subs[person] = [];
  if (!subs[person].some(s => s.endpoint === subscription.endpoint)) subs[person].push(subscription);
  saveSubs(subs);
  res.json({ ok: true });
});

app.get('/api/schedule', (req, res) => res.json(scheduleData));

app.post('/api/schedule/update', async (req, res) => {
  const { task, dayIdx, person } = req.body;
  if (!scheduleData[task]) return res.status(400).json({ error: 'invalid task' });
  scheduleData[task][dayIdx] = person;
  saveSchedule(scheduleData);
  // Re-sync calendars for all connected people
  const tokens = loadTokens();
  for (const p of Object.keys(tokens)) {
    syncCalendarForPerson(p).catch(e => console.error('Sync error for ' + p + ':', e.message));
  }
  res.json({ ok: true, schedule: scheduleData });
});

app.get('/api/vapid-key', (req, res) => res.json({ key: VAPID_PUBLIC }));

app.get('/api/calendar-status/:person', (req, res) => {
  const person = decodeURIComponent(req.params.person);
  const tokens = loadTokens();
  res.json({ connected: !!tokens[person] });
});

app.post('/api/calendar-sync/:person', async (req, res) => {
  const person = decodeURIComponent(req.params.person);
  const result = await syncCalendarForPerson(person);
  res.json(result);
});

app.post('/api/test-push', async (req, res) => {
  const { person } = req.body;
  const subs = loadSubs();
  if (!(subs[person] || []).length) return res.status(404).json({ error: 'no subscription for this person' });
  await sendPushToPerson(person, '🐕 בדיקה!', 'זוהי הודעת בדיקה לסוניק עבור ' + person, '');
  res.json({ ok: true });
});

// Save schedule as permanent default via Render API
app.post('/api/schedule/save-default', async (req, res) => {
  if (!RENDER_API_KEY || !RENDER_SERVICE_ID) {
    return res.status(500).json({ error: 'Render API not configured' });
  }
  try {
    const scheduleJson = JSON.stringify(scheduleData);
    // Get current env vars
    const getRes = await fetch('https://api.render.com/v1/services/' + RENDER_SERVICE_ID + '/env-vars', {
      headers: { 'Authorization': 'Bearer ' + RENDER_API_KEY, 'Accept': 'application/json' }
    });
    const envVars = await getRes.json();
    
    // Build updated env vars list
    const updated = envVars.map(e => e.envVar ? e.envVar : e).map(e => ({
      key: e.key,
      value: e.key === 'SCHEDULE_DATA' ? scheduleJson : e.value
    }));
    
    // If SCHEDULE_DATA doesn't exist, add it
    if (!updated.find(e => e.key === 'SCHEDULE_DATA')) {
      updated.push({ key: 'SCHEDULE_DATA', value: scheduleJson });
    }
    
    // Update env vars
    const putRes = await fetch('https://api.render.com/v1/services/' + RENDER_SERVICE_ID + '/env-vars', {
      method: 'PUT',
      headers: { 
        'Authorization': 'Bearer ' + RENDER_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(updated)
    });
    
    if (putRes.ok) {
      res.json({ ok: true, message: 'הלוח נשמר כבסיס קבוע!' });
    } else {
      const err = await putRes.text();
      res.status(500).json({ error: err });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Sonic server running on port ' + PORT));
