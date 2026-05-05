'use strict';

const DAYS = ['א','ב','ג','ד','ה','ו','שבת'];
const TASKS = ['morning','noon','evening','teeth','sleep'];
const TASK_HE = { morning:'הוצאת בוקר', noon:'הוצאת צהריים', evening:'הוצאת ערב', teeth:'צחצוח שיניים', sleep:'שינה' };
const TASK_EMOJI = { morning:'🌅', noon:'☀️', evening:'🌙', teeth:'🦷', sleep:'😴' };

let schedule = null;
let currentPerson = localStorage.getItem('sonic_person') || null;
let swRegistration = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await loadSchedule();
  renderAll();
  registerSW();
  updateNotifyBtn();
  if (currentPerson) {
    document.querySelectorAll('.person-btn').forEach(b => {
      if (b.textContent.trim() === currentPerson) b.classList.add('active');
    });
  }
}

async function loadSchedule() {
  try {
    const r = await fetch('/api/schedule');
    schedule = await r.json();
  } catch {
    schedule = {
      morning: ['יובל','יובל','עומר','הורים','עומר','עומר','יובל'],
      noon:    ['יובל','עומר','עומר','יובל','עומר','יובל','עומר'],
      evening: ['יובל','עומר','יובל','יובל','עומר','יובל','עומר'],
      teeth:   ['עומר','עומר','עומר','עומר','עומר','עומר','עומר'],
      sleep:   ['יובל','יובל','עומר','הורים','עומר','עומר','יובל'],
    };
  }
}

function getTodayIdx() {
  return new Date().getDay(); // 0=Sun=א, 1=Mon=ב ... 6=Sat=שבת
}

function personClass(p) {
  if (p === 'יובל') return 'yuval';
  if (p === 'עומר') return 'omer';
  return 'parents';
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderAll() {
  renderConflicts();
  renderToday();
  renderSummary();
  renderWeekTable();
  populateSwaps();
}

function renderConflicts() {
  const area = document.getElementById('conflict-area');
  if (!schedule) return;
  const conflicts = [];
  DAYS.forEach((d, i) => {
    if (schedule.morning[i] !== 'הורים' && schedule.morning[i] !== schedule.sleep[i]) {
      conflicts.push(`יום ${d}: בוקר (${schedule.morning[i]}) לא תואם לשינה (${schedule.sleep[i]})`);
    }
  });
  area.innerHTML = conflicts.map(c => `<div class="conflict">⚠️ ${c}</div>`).join('');
}

function renderToday() {
  const container = document.getElementById('today-tasks');
  if (!schedule) return;
  const todayIdx = getTodayIdx();
  const dayName = 'יום ' + DAYS[todayIdx];

  const activeTasks = ['morning','noon','evening','teeth'];
  const times = { morning: getTime('morning'), noon: getTime('noon'), evening: getTime('evening'), teeth: getTime('teeth') };

  container.innerHTML = activeTasks.map(task => {
    const person = schedule[task][todayIdx];
    const isMine = currentPerson && (person === currentPerson || (person === 'הורים' && (currentPerson === 'יריב' || currentPerson === 'שירה')));
    const phones = getPhones(person);
    const timeStr = times[task];
    const msgText = `🐕 הגיע הזמן: ${TASK_HE[task]} לסוניק עכשיו (${timeStr})!`;

    return `
      <div class="today-card" style="${isMine ? 'border-color: var(--green); border-width: 2px;' : ''}">
        <div class="today-header">
          <span>${TASK_EMOJI[task]} ${TASK_HE[task]}</span>
          <span class="today-time">${timeStr}</span>
        </div>
        <div class="today-person">
          <span class="badge ${personClass(person)}">${person}</span>
          ${isMine ? '<span style="font-size:11px;color:var(--green-dark);margin-right:8px">← זה אתה!</span>' : ''}
          ${phones.map(({name, phone}) => `
            <a class="wa-link" href="${waLink(phone, msgText)}" target="_blank">📱 שלח לוואטסאפ${phones.length > 1 ? ` (${name})` : ''}</a>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderSummary() {
  if (!schedule) return;
  const counts = { יובל: 0, עומר: 0, הורים: 0 };
  TASKS.forEach(t => schedule[t].forEach(p => { if (counts[p] !== undefined) counts[p]++; }));
  document.getElementById('summary-grid').innerHTML = `
    <div class="sum-card yuval">  <div class="num">${counts['יובל']}</div> <div class="lbl">יובל</div></div>
    <div class="sum-card omer">   <div class="num">${counts['עומר']}</div>  <div class="lbl">עומר</div></div>
    <div class="sum-card parents"><div class="num">${counts['הורים']}</div><div class="lbl">הורים</div></div>
  `;
}

function renderWeekTable() {
  if (!schedule) return;
  const todayIdx = getTodayIdx();
  let html = '<thead><tr><th></th>';
  DAYS.forEach((d, i) => {
    html += `<th class="${i === todayIdx ? 'today-col' : ''}">יום<br>${d}</th>`;
  });
  html += '</tr></thead><tbody>';

  TASKS.forEach(task => {
    html += `<tr><td class="row-lbl">${TASK_HE[task]}</td>`;
    DAYS.forEach((d, i) => {
      const p = schedule[task][i];
      html += `<td class="${i === todayIdx ? 'today-col' : ''}"><span class="badge ${personClass(p)}">${p}</span></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  document.getElementById('week-table').innerHTML = html;
}

function populateSwaps() {
  const taskSel = document.getElementById('swap-task');
  taskSel.innerHTML = ['morning','noon','evening','teeth','sleep'].map(t =>
    `<option value="${t}">${TASK_HE[t]}</option>`
  ).join('');
  const dayOpts = DAYS.map((d, i) => `<option value="${i}">יום ${d}</option>`).join('');
  document.getElementById('swap-day1').innerHTML = dayOpts;
  document.getElementById('swap-day2').innerHTML = dayOpts;
  document.getElementById('swap-day2').value = 1;
}

// ─── Interactions ─────────────────────────────────────────────────────────────
function showTab(name, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  el.classList.add('active');
}

function selectPerson(name, el) {
  document.querySelectorAll('.person-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  currentPerson = name;
  localStorage.setItem('sonic_person', name);
  renderToday();
  updateNotifyBtn();
}

async function doSwap() {
  const task = document.getElementById('swap-task').value;
  const day1 = parseInt(document.getElementById('swap-day1').value);
  const day2 = parseInt(document.getElementById('swap-day2').value);
  if (day1 === day2) { showToast('בחר שני ימים שונים'); return; }

  try {
    const r = await fetch('/api/schedule/swap', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ task, day1, day2 })
    });
    const data = await r.json();
    schedule = data.schedule;
    renderAll();
    showToast('✅ ההחלפה בוצעה!');
  } catch {
    // fallback: local swap
    const tmp = schedule[task][day1];
    schedule[task][day1] = schedule[task][day2];
    schedule[task][day2] = tmp;
    renderAll();
    showToast('✅ ההחלפה בוצעה (מקומי)');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTime(task) {
  const map = { morning:'t-morning', noon:'t-noon', evening:'t-evening', teeth:'t-teeth' };
  return document.getElementById(map[task])?.value || '';
}

function getPhones(person) {
  if (person === 'הורים') {
    return [
      { name: 'יריב', phone: document.getElementById('p-yariv').value },
      { name: 'שירה', phone: document.getElementById('p-shira').value },
    ];
  }
  const map = { יובל: 'p-yuval', עומר: 'p-omer', יריב: 'p-yariv', שירה: 'p-shira' };
  const el = document.getElementById(map[person]);
  return el ? [{ name: person, phone: el.value }] : [];
}

function waLink(phone, msg) {
  const clean = phone.replace(/\D/g,'').replace(/^0/,'972');
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function saveSettings() { renderToday(); }

// ─── Push Notifications ───────────────────────────────────────────────────────
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    console.log('SW registered');
  } catch (e) { console.error('SW registration failed:', e); }
}

function updateNotifyBtn() {
  const btn = document.getElementById('notify-btn');
  if (!('Notification' in window)) { btn.style.display = 'none'; return; }
  if (Notification.permission === 'granted' && currentPerson) {
    btn.textContent = '🔔 התראות פעילות';
    btn.classList.add('subscribed');
  } else {
    btn.textContent = '🔔 הפעל התראות';
    btn.classList.remove('subscribed');
  }
}

async function handleNotifyBtn() {
  if (!currentPerson) { showToast('קודם בחר מי אתה 👆'); return; }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('הדפדפן לא תומך בהתראות'); return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') { showToast('ההרשאה נדחתה'); return; }

  try {
    const keyRes = await fetch('/api/vapid-key');
    const { key } = await keyRes.json();
    if (!key) { showToast('השרת לא מוגדר עם VAPID'); return; }

    const reg = swRegistration || await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key)
    });

    await fetch('/api/subscribe', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ subscription: sub, person: currentPerson })
    });

    updateNotifyBtn();
    showToast(`✅ התראות הופעלו עבור ${currentPerson}!`);
  } catch (e) {
    console.error(e);
    showToast('שגיאה בהפעלת התראות');
  }
}

async function testPush() {
  if (!currentPerson) { showToast('קודם בחר מי אתה בלשונית היום'); return; }
  try {
    const r = await fetch('/api/test-push', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ person: currentPerson })
    });
    const d = await r.json();
    if (d.ok) showToast('📨 בדיקה נשלחה!');
    else showToast('שגיאה: ' + d.error);
  } catch { showToast('לא ניתן להתחבר לשרת'); }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

init();
