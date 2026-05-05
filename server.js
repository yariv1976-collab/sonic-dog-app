const express = require('express');
const webpush = require('web-push');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || '';
const VAPID_EMAIL   = process.env.VAPID_EMAIL   || 'mailto:yariv1976@gmail.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

const SUBS_FILE = path.join(__dirname, 'subscriptions.json');
function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch { return {}; }
}
function saveSubs(subs) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

const SCHEDULE_FILE = path.join(__dirname, 'schedule.json');
const DEFAULT_SCHEDULE = {
  morning: ['יובל','יובל','עומר','הורים','עומר','עומר','יובל'],
  noon:    ['יובל','עומר','עומר','יובל','עומר','יובל','עומר'],
  evening: ['יובל','עומר','יובל','יובל','עומר','יובל','עומר'],
  teeth:   ['עומר','עומר','עומר','עומר','עומר','עומר','עומר'],
  sleep:   ['יובל','יובל','עומר','הורים','עומר','עומר','יובל'],
};
function loadSchedule() {
  try { return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8')); }
  catch { return JSON.parse(JSON.stringify(DEFAULT_SCHEDULE)); }
}
function saveSchedule(s) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(s, null, 2));
}
let scheduleData = loadSchedule();

const PHONES = {
  'יובל': '972584997372',
  'עומר': '972584271372',
  'יריב': '972542271372',
  'שירה': '972544997372',
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

function getTodayIdx() {
  return new Date().getDay();
}

function getPersonForTask(task, dayIdx) {
  return scheduleData[task][dayIdx];
}

function getWaLink(phone, msg) {
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);
}

async function sendPushToPerson(personName, title, body, waUrl) {
  const subs = loadSubs();
  const personSubs = subs[personName] || [];
  if (personSubs.length === 0) return;
  const payload = JSON.stringify({ title, body, waUrl, person: personName });
  for (const sub of personSubs) {
    try {
      await webpush.sendNotification(sub, payload);
    } catch (err) {
      console.error('Push failed for ' + personName + ':', err.statusCode);
    }
  }
}

async function sendTaskNotification(task, isReminder) {
  const dayIdx = getTodayIdx();
  const person = getPersonForTask(task, dayIdx);
  const label = TASK_LABELS[task];
  const time = TIMES[task];
  const timeStr = String(time.h).padStart(2,'0') + ':' + String(time.m).padStart(2,'0');
  const people = person === 'הורים' ? ['יריב', 'שירה'] : [person];

  for (const p of people) {
    const phone = PHONES[p];
    const msgText = isReminder
      ? '🐕 תזכורת: בעוד חצי שעה (' + timeStr + ') יש ' + label + ' לסוניק!'
      : '🐕 הגיע הזמן: ' + label + ' לסוניק עכשיו (' + timeStr + ')!';
    const waUrl = getWaLink(phone, msgText);
    const title = isReminder ? ('⏰ תזכורת — ' + label) : ('🔔 ' + label + ' לסוניק!');
    await sendPushToPerson(p, title, msgText, waUrl);
    console.log('[' + new Date().toISOString() + '] Sent push to ' + p + ' for ' + task + ' (reminder=' + isReminder + ')');
  }
}

// Cron jobs (Israel UTC+3)
cron.schedule('30 4 * * *',  () => sendTaskNotification('morning', true));
cron.schedule('0 5 * * *',   () => sendTaskNotification('morning', false));
cron.schedule('0 11 * * *',  () => sendTaskNotification('noon', true));
cron.schedule('30 11 * * *', () => sendTaskNotification('noon', false));
cron.schedule('30 16 * * *', () => sendTaskNotification('evening', true));
cron.schedule('0 17 * * *',  () => sendTaskNotification('evening', false));
cron.schedule('30 17 * * *', () => sendTaskNotification('teeth', true));
cron.schedule('0 18 * * *',  () => sendTaskNotification('teeth', false));

// API
app.post('/api/subscribe', (req, res) => {
  const { subscription, person } = req.body;
  if (!subscription || !person) return res.status(400).json({ error: 'missing fields' });
  const subs = loadSubs();
  if (!subs[person]) subs[person] = [];
  const exists = subs[person].some(s => s.endpoint === subscription.endpoint);
  if (!exists) subs[person].push(subscription);
  saveSubs(subs);
  console.log('Subscription saved for ' + person);
  res.json({ ok: true });
});

app.post('/api/unsubscribe', (req, res) => {
  const { endpoint, person } = req.body;
  const subs = loadSubs();
  if (subs[person]) {
    subs[person] = subs[person].filter(s => s.endpoint !== endpoint);
    saveSubs(subs);
  }
  res.json({ ok: true });
});

app.get('/api/schedule', (req, res) => res.json(scheduleData));

app.post('/api/schedule/update', (req, res) => {
  const { task, dayIdx, person } = req.body;
  if (!scheduleData[task]) return res.status(400).json({ error: 'invalid task' });
  scheduleData[task][dayIdx] = person;
  saveSchedule(scheduleData);
  res.json({ ok: true, schedule: scheduleData });
});

app.post('/api/schedule/swap', (req, res) => {
  const { task, day1, day2 } = req.body;
  if (!scheduleData[task]) return res.status(400).json({ error: 'invalid task' });
  const tmp = scheduleData[task][day1];
  scheduleData[task][day1] = scheduleData[task][day2];
  scheduleData[task][day2] = tmp;
  saveSchedule(scheduleData);
  res.json({ ok: true, schedule: scheduleData });
});

app.get('/api/vapid-key', (req, res) => res.json({ key: VAPID_PUBLIC }));

app.post('/api/test-push', async (req, res) => {
  const { person } = req.body;
  const subs = loadSubs();
  const personSubs = subs[person] || [];
  if (personSubs.length === 0) return res.status(404).json({ error: 'no subscription for this person' });
  await sendPushToPerson(person, '🐕 בדיקה!', 'זוהי הודעת בדיקה לסוניק עבור ' + person, 'https://wa.me/');
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Sonic server running on port ' + PORT));
