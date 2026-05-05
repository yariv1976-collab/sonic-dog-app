const express = require('express');
const webpush = require('web-push');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ─── VAPID Keys (generated once, stored in env) ───────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || '';
const VAPID_EMAIL   = process.env.VAPID_EMAIL   || 'mailto:admin@sonic-dog.app';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

// ─── Subscriptions storage (file-based, simple) ──────────────────────────────
const SUBS_FILE = path.join(__dirname, 'subscriptions.json');
function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch { return {}; }
}
function saveSubs(subs) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

// ─── Schedule data ────────────────────────────────────────────────────────────
let scheduleData = {
  morning:  ['יובל','יובל','עומר','הורים','עומר','עומר','יובל'],
  noon:     ['יובל','עומר','עומר','יובל','עומר','יובל','עומר'],
  evening:  ['יובל','עומר','יובל','יובל','עומר','יובל','עומר'],
  teeth:    ['עומר','עומר','עומר','עומר','עומר','עומר','עומר'],
  sleep:    ['יובל','יובל','עומר','הורים','עומר','עומר','יובל'],
};

const PHONES = {
  יובל:  '972584997372',
  עומר:  '972584271372',
  יריב:  '972542271372',
  שירה:  '972544997372',
};

const TASK_LABELS = {
  morning: 'הוצאת בוקר',
  noon:    'הוצאת צהריים',
  evening: 'הוצאת ערב',
  teeth:   'צחצוח שיניים',
};

const TIMES = {
  morning: { h: 8,  m: 0  },
  noon:    { h: 14, m: 30 },
  evening: { h: 20, m: 0  },
  teeth:   { h: 21, m: 0  },
};

// ─── Helper: get day index (0=Sun→6, mapped to our week 0=Mon) ────────────────
// Our week: 0=א(Sun) 1=ב(Mon) ... 6=שבת(Sat)
function getTodayIdx() {
  const d = new Date().getDay(); // 0=Sun
  return d === 6 ? 6 : d; // Sun=0, Mon=1 ... Fri=5, Sat=6 → keep as-is except Sun stays 0
  // Actually: Sun=0,Mon=1,Tue=2,Wed=3,Thu=4,Fri=5,Sat=6
}

function getPersonForTask(task, dayIdx) {
  return scheduleData[task][dayIdx];
}

function getWaLink(phone, msg) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// ─── Send push to a person ────────────────────────────────────────────────────
async function sendPushToPerson(personName, title, body, waUrl) {
  const subs = loadSubs();
  const personSubs = subs[personName] || [];
  if (personSubs.length === 0) return;

  const payload = JSON.stringify({ title, body, waUrl, person: personName });

  for (const sub of personSubs) {
    try {
      await webpush.sendNotification(sub, payload);
    } catch (err) {
      console.error(`Push failed for ${personName}:`, err.statusCode);
    }
  }
}

async function sendTaskNotification(task, isReminder) {
  const dayIdx = getTodayIdx();
  const person = getPersonForTask(task, dayIdx);
  const label = TASK_LABELS[task];
  const time = TIMES[task];
  const timeStr = `${String(time.h).padStart(2,'0')}:${String(time.m).padStart(2,'0')}`;

  const people = person === 'הורים' ? ['יריב', 'שירה'] : [person];

  for (const p of people) {
    const phone = PHONES[p];
    const msgText = isReminder
      ? `🐕 תזכורת: בעוד חצי שעה (${timeStr}) יש ${label} לסוניק!`
      : `🐕 הגיע הזמן: ${label} לסוניק עכשיו (${timeStr})!`;

    const waUrl = getWaLink(phone, msgText);
    const title = isReminder ? `⏰ תזכורת — ${label}` : `🔔 ${label} לסוניק!`;

    await sendPushToPerson(p, title, msgText, waUrl);
    console.log(`[${new Date().toISOString()}] Sent push to ${p} for ${task} (reminder=${isReminder})`);
  }
}

// ─── Cron jobs (Israel time = UTC+3) ─────────────────────────────────────────
// Reminder = 30 min before, Notification = on time
// Times in UTC (Israel UTC+3):
// Morning   08:00 IL = 05:00 UTC, reminder 07:30 IL = 04:30 UTC
// Noon      14:30 IL = 11:30 UTC, reminder 14:00 IL = 11:00 UTC
// Evening   20:00 IL = 17:00 UTC, reminder 19:30 IL = 16:30 UTC
// Teeth     21:00 IL = 18:00 UTC, reminder 20:30 IL = 17:30 UTC

cron.schedule('30 4 * * *',  () => sendTaskNotification('morning', true));
cron.schedule('0 5 * * *',   () => sendTaskNotification('morning', false));
cron.schedule('0 11 * * *',  () => sendTaskNotification('noon', true));
cron.schedule('30 11 * * *', () => sendTaskNotification('noon', false));
cron.schedule('30 16 * * *', () => sendTaskNotification('evening', true));
cron.schedule('0 17 * * *',  () => sendTaskNotification('evening', false));
cron.schedule('30 17 * * *', () => sendTaskNotification('teeth', true));
cron.schedule('0 18 * * *',  () => sendTaskNotification('teeth', false));

// ─── API Routes ───────────────────────────────────────────────────────────────

// Save push subscription
app.post('/api/subscribe', (req, res) => {
  const { subscription, person } = req.body;
  if (!subscription || !person) return res.status(400).json({ error: 'missing fields' });

  const subs = loadSubs();
  if (!subs[person]) subs[person] = [];

  // Avoid duplicates
  const exists = subs[person].some(s => s.endpoint === subscription.endpoint);
  if (!exists) subs[person].push(subscription);
  saveSubs(subs);

  console.log(`Subscription saved for ${person}`);
  res.json({ ok: true });
});

// Remove subscription
app.post('/api/unsubscribe', (req, res) => {
  const { endpoint, person } = req.body;
  const subs = loadSubs();
  if (subs[person]) {
    subs[person] = subs[person].filter(s => s.endpoint !== endpoint);
    saveSubs(subs);
  }
  res.json({ ok: true });
});

// Get schedule
app.get('/api/schedule', (req, res) => res.json(scheduleData));

// Update schedule (swap)
app.post('/api/schedule/swap', (req, res) => {
  const { task, day1, day2 } = req.body;
  if (!scheduleData[task]) return res.status(400).json({ error: 'invalid task' });
  const tmp = scheduleData[task][day1];
  scheduleData[task][day1] = scheduleData[task][day2];
  scheduleData[task][day2] = tmp;
  res.json({ ok: true, schedule: scheduleData });
});

// Update single cell
app.post('/api/schedule/update', (req, res) => {
  const { task, dayIdx, person } = req.body;
  if (!scheduleData[task]) return res.status(400).json({ error: 'invalid task' });
  scheduleData[task][dayIdx] = person;
  res.json({ ok: true });
});


app.get('/api/vapid-key', (req, res) => res.json({ key: VAPID_PUBLIC }));

// Test push (dev only)
app.post('/api/test-push', async (req, res) => {
  const { person } = req.body;
  const subs = loadSubs();
  const personSubs = subs[person] || [];
  if (personSubs.length === 0) return res.status(404).json({ error: 'no subscription for this person' });

  await sendPushToPerson(person, '🐕 בדיקה!', `זוהי הודעת בדיקה לסוניק עבור ${person}`, 'https://wa.me/');
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sonic server running on port ${PORT}`));
