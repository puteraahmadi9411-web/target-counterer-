// ── STATE ──────────────────────────────────────────────────────────────────
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function defaultState() {
  return {
    target: 600,
    routineAmount: 9,
    routineDays: [1,2,3,4,5], // Mon–Fri
    total: 0,
    lastCollected: null, // ISO date string
    entries: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem('targetCounterer');
    return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
  } catch { return defaultState(); }
}

function saveState() {
  localStorage.setItem('targetCounterer', JSON.stringify(state));
}

let state = loadState();

// ── HELPERS ────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0,10);
}
function todayDow() {
  return new Date().getDay();
}
function fmt(n) {
  return 'RM ' + parseFloat(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function fmtShort(n) {
  return parseFloat(n).toFixed(2);
}
function relDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-MY', { day:'numeric', month:'short' });
}

// ── RENDER ─────────────────────────────────────────────────────────────────
function render() {
  const pct = Math.min(100, (state.total / state.target) * 100);
  const remaining = Math.max(0, state.target - state.total);
  const isTodayRoutine = state.routineDays.includes(todayDow());
  const alreadyCollected = state.lastCollected === todayStr();

  // Progress
  document.getElementById('amount-current').textContent = fmtShort(state.total);
  document.getElementById('amount-target').innerHTML = `of <span>RM ${fmtShort(state.target)}</span>`;
  const fill = document.getElementById('progress-fill');
  fill.style.width = pct + '%';
  fill.className = 'progress-fill' + (pct >= 100 ? ' complete' : '');
  document.getElementById('progress-pct').textContent = pct.toFixed(1) + '%';
  document.getElementById('progress-remaining').textContent =
    pct >= 100 ? '🎯 Target reached!' : `RM ${fmtShort(remaining)} to go`;

  // Collect button / banner
  const collectSection = document.getElementById('collect-section');
  const banner = document.getElementById('routine-banner');

  if (isTodayRoutine && !alreadyCollected) {
    collectSection.style.display = 'block';
    document.getElementById('collect-label').textContent =
      `Collect Daily RM ${fmtShort(state.routineAmount)}`;
    banner.style.display = 'none';
  } else {
    collectSection.style.display = 'none';
    banner.style.display = 'flex';
    if (alreadyCollected) {
      banner.className = 'routine-banner done';
      banner.innerHTML = `<span>✓</span> Daily RM ${fmtShort(state.routineAmount)} collected — see you tomorrow!`;
    } else {
      banner.className = 'routine-banner not-today';
      banner.innerHTML = `<span>○</span> No routine today (${DAY_FULL[todayDow()]})`;
    }
  }

  // Stats
  const routineTotal = state.entries.filter(e => e.type === 'routine').reduce((s,e) => s + e.amount, 0);
  const manualTotal  = state.entries.filter(e => e.type === 'manual').reduce((s,e) => s + e.amount, 0);
  document.getElementById('stat-routine').innerHTML =
    `RM <span class="unit"></span>${fmtShort(routineTotal)}`;
  document.getElementById('stat-manual').innerHTML =
    `RM <span class="unit"></span>${fmtShort(manualTotal)}`;

  // Entry list (most recent first, max 20)
  const list = document.getElementById('entry-list');
  const recent = [...state.entries].reverse().slice(0,20);
  if (recent.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div>No entries yet.<br>Hit Collect or + to start!</div>`;
  } else {
    list.innerHTML = recent.map(e => `
      <div class="entry-item">
        <div class="entry-left">
          <div class="entry-icon ${e.type}">${e.type === 'routine' ? '⚡' : '＋'}</div>
          <div>
            <div class="entry-desc">${e.note || (e.type === 'routine' ? 'Daily Routine' : 'Manual Entry')}</div>
            <div class="entry-date">${relDate(e.date)}</div>
          </div>
        </div>
        <div class="entry-amount">+RM ${fmtShort(e.amount)}</div>
      </div>
    `).join('');
  }

  // Settings fields sync
  document.getElementById('s-target').value = state.target;
  document.getElementById('s-routine-amount').value = state.routineAmount;
  document.querySelectorAll('.day-btn').forEach(btn => {
    const d = parseInt(btn.dataset.day);
    btn.classList.toggle('active', state.routineDays.includes(d));
  });
}

// ── ACTIONS ────────────────────────────────────────────────────────────────
function collectRoutine() {
  state.total += state.routineAmount;
  state.lastCollected = todayStr();
  state.entries.push({
    type: 'routine',
    amount: state.routineAmount,
    date: todayStr(),
    note: 'Daily Routine'
  });
  saveState();
  render();
  showToast(`+RM ${fmtShort(state.routineAmount)} collected! 🎯`);
  burst();
}

function addManual(amount, note) {
  const n = parseFloat(amount);
  if (!n || n <= 0) return;
  state.total += n;
  state.entries.push({
    type: 'manual',
    amount: n,
    date: todayStr(),
    note: note || 'Manual Entry'
  });
  saveState();
  render();
  showToast(`+RM ${fmtShort(n)} added!`);
}

function saveSettings() {
  const t = parseFloat(document.getElementById('s-target').value);
  const r = parseFloat(document.getElementById('s-routine-amount').value);
  if (!t || t <= 0 || !r || r <= 0) { showToast('Enter valid amounts ✗', true); return; }
  state.target = t;
  state.routineAmount = r;
  saveState();
  render();
  showToast('Settings saved ✓');
  showDashboard();
}

function resetAll() {
  if (!confirm('Reset ALL data? This cannot be undone.')) return;
  state = defaultState();
  saveState();
  render();
  showToast('Data reset');
  showDashboard();
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────
function showSettings() {
  document.getElementById('dashboard-page').classList.add('hidden');
  document.getElementById('settings-page').classList.add('active');
  document.getElementById('nav-title').textContent = 'SETTINGS';
  document.getElementById('nav-settings-btn').innerHTML = '←';
  document.getElementById('nav-settings-btn').onclick = showDashboard;
}
function showDashboard() {
  document.getElementById('settings-page').classList.remove('active');
  document.getElementById('dashboard-page').classList.remove('hidden');
  document.getElementById('nav-title').textContent = 'TARGET COUNTERER';
  document.getElementById('nav-settings-btn').innerHTML = '⚙';
  document.getElementById('nav-settings-btn').onclick = showSettings;
}

// ── MODAL ──────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ── TOAST ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── CONFETTI ───────────────────────────────────────────────────────────────
const BURST_COLORS = ['#00ff87','#00c86a','#a3ff60','#fff','#ffdd57'];
function burst() {
  for (let i = 0; i < 12; i++) {
    const el = document.createElement('div');
    el.className = 'burst';
    el.style.cssText = `
      left: ${30 + Math.random()*40}%;
      top: ${30 + Math.random()*40}%;
      background: ${BURST_COLORS[Math.floor(Math.random()*BURST_COLORS.length)]};
      animation-delay: ${Math.random()*0.2}s;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }
}

// ── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Date in nav
  const now = new Date();
  document.getElementById('nav-date').textContent =
    now.toLocaleDateString('en-MY', { weekday:'short', day:'numeric', month:'short' });

  render();

  // Collect button
  document.getElementById('collect-btn').onclick = collectRoutine;

  // FAB → open manual modal
  document.getElementById('fab').onclick = () => {
    document.getElementById('manual-amount').value = '';
    document.getElementById('manual-note').value = '';
    openModal('manual-modal');
    setTimeout(() => document.getElementById('manual-amount').focus(), 350);
  };

  // Manual modal confirm
  document.getElementById('manual-confirm').onclick = () => {
    const amt = document.getElementById('manual-amount').value;
    const note = document.getElementById('manual-note').value.trim();
    if (!parseFloat(amt) || parseFloat(amt) <= 0) {
      showToast('Enter a valid amount');
      return;
    }
    addManual(amt, note);
    closeModal('manual-modal');
  };
  document.getElementById('manual-cancel').onclick = () => closeModal('manual-modal');

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Day toggle buttons
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.onclick = () => {
      const d = parseInt(btn.dataset.day);
      const idx = state.routineDays.indexOf(d);
      if (idx === -1) state.routineDays.push(d);
      else state.routineDays.splice(idx, 1);
      btn.classList.toggle('active');
      saveState();
    };
  });

  // Settings
  document.getElementById('nav-settings-btn').onclick = showSettings;
  document.getElementById('save-settings-btn').onclick = saveSettings;
  document.getElementById('reset-btn').onclick = resetAll;

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }
});
