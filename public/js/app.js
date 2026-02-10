// NASCAR Pick'em — Main App
const App = (() => {
  // ========== CONFIG ==========
  const SUPABASE_URL = ''; // Set after creating Supabase project
  const SUPABASE_KEY = ''; // anon/public key
  const NASCAR_SCHEDULE_URL = 'https://cf.nascar.com/cacher/2025/1/schedule-feed.json';
  const NASCAR_LIVE_URL = (raceId) => `https://cf.nascar.com/cacher/live/series_1/${raceId}/live-feed.json`;

  const PLAYERS = ['Brandon', 'Mom', 'Dad', 'Greg', 'Matt'];
  const MAX_PICKS_PER_DRIVER = 5;

  // Local storage keys
  const LS_SCHEDULE = 'nascar_schedule';
  const LS_PICKS = 'nascar_picks';
  const LS_RESULTS = 'nascar_results';

  let schedule = [];
  let picks = [];    // { player, raceId, driver, driverNum }
  let results = [];  // { raceId, raceName, finishOrder: [{player, driver, driverNum, position}], winner }
  let liveInterval = null;

  // ========== INIT ==========
  function init() {
    loadLocalData();
    setupNav();
    loadSchedule();
  }

  // ========== NAVIGATION ==========
  function setupNav() {
    document.querySelectorAll('nav a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        document.querySelectorAll('nav a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
      });
    });
  }

  // ========== LOCAL STORAGE ==========
  function loadLocalData() {
    try {
      picks = JSON.parse(localStorage.getItem(LS_PICKS)) || [];
      results = JSON.parse(localStorage.getItem(LS_RESULTS)) || [];
      schedule = JSON.parse(localStorage.getItem(LS_SCHEDULE)) || [];
    } catch (e) {
      picks = []; results = []; schedule = [];
    }
  }

  function saveLocalData() {
    localStorage.setItem(LS_PICKS, JSON.stringify(picks));
    localStorage.setItem(LS_RESULTS, JSON.stringify(results));
    localStorage.setItem(LS_SCHEDULE, JSON.stringify(schedule));
  }

  // ========== NASCAR SCHEDULE ==========
  async function loadSchedule() {
    // Try to fetch fresh schedule, fall back to cached
    try {
      const resp = await fetch(NASCAR_SCHEDULE_URL);
      if (resp.ok) {
        const data = await resp.json();
        // Filter to only race events (run_type 3) for Cup Series
        schedule = data
          .filter(e => e.run_type === 3 && e.event_name === 'Race')
          .map(e => ({
            raceId: e.race_id,
            name: e.race_name,
            track: e.track_name,
            date: e.start_time_utc,
            dateLocal: e.start_time,
            seriesId: e.series_id
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        saveLocalData();
      }
    } catch (e) {
      console.log('Using cached schedule');
    }

    renderAll();
  }

  // ========== RENDER EVERYTHING ==========
  function renderAll() {
    renderNextRace();
    renderStandings();
    renderLastRace();
    renderResults();
    renderSchedule();
    renderDriverUsage();
    populateAdminDropdowns();
  }

  // ========== NEXT RACE BANNER ==========
  function renderNextRace() {
    const now = new Date();
    const nextRace = schedule.find(r => new Date(r.date) > now);
    if (!nextRace) {
      document.getElementById('next-race-name').textContent = 'Season Complete!';
      return;
    }

    document.getElementById('next-race-name').textContent = nextRace.name;
    document.getElementById('next-race-track').textContent = nextRace.track;
    document.getElementById('next-race-date').textContent = formatDate(nextRace.dateLocal || nextRace.date);

    // Countdown
    updateCountdown(nextRace.date);
    setInterval(() => updateCountdown(nextRace.date), 1000);

    // Pick status badges
    const statusDiv = document.getElementById('picks-status');
    statusDiv.innerHTML = PLAYERS.map(p => {
      const hasPick = picks.find(pk => pk.raceId === nextRace.raceId && pk.player === p);
      if (hasPick) {
        return `<span class="pick-badge locked">${p}: ${hasPick.driver}</span>`;
      }
      return `<span class="pick-badge pending">${p}: ?</span>`;
    }).join('');
  }

  function updateCountdown(dateStr) {
    const el = document.getElementById('countdown-timer');
    const diff = new Date(dateStr) - new Date();
    if (diff <= 0) {
      el.textContent = 'RACE DAY!';
      el.style.color = '#00E676';
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    if (d > 0) {
      el.textContent = `${d}d ${h}h ${m}m`;
    } else {
      el.textContent = `${h}h ${m}m ${s}s`;
    }
  }

  // ========== STANDINGS ==========
  function renderStandings() {
    const stats = PLAYERS.map(player => {
      const playerResults = results.map(r => {
        const entry = r.finishOrder.find(f => f.player === player);
        return entry ? { ...entry, winner: r.winner } : null;
      }).filter(Boolean);

      const wins = playerResults.filter(r => r.player === r.winner).length;
      const seconds = playerResults.filter((r, i) => {
        const race = results[i];
        const sorted = [...race.finishOrder].sort((a, b) => a.position - b.position);
        return sorted[1] && sorted[1].player === player;
      }).length;
      const thirds = playerResults.filter((r, i) => {
        const race = results[i];
        const sorted = [...race.finishOrder].sort((a, b) => a.position - b.position);
        return sorted[2] && sorted[2].player === player;
      }).length;

      const positions = playerResults.map(r => r.position).filter(p => p != null);
      const avgFinish = positions.length > 0
        ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1)
        : '--';

      // Streak
      let streak = '';
      if (results.length > 0) {
        let count = 0;
        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i].winner === player) count++;
          else break;
        }
        if (count >= 2) streak = `🔥 ${count}W`;
      }

      return { player, wins, seconds, thirds, avgFinish, streak };
    });

    // Sort by wins desc, then avg finish asc
    stats.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.avgFinish === '--') return 1;
      if (b.avgFinish === '--') return -1;
      return parseFloat(a.avgFinish) - parseFloat(b.avgFinish);
    });

    const tbody = document.getElementById('standings-body');
    tbody.innerHTML = stats.map((s, i) => {
      const rankClass = i === 0 ? 'first' : i === 1 ? 'second' : i === 2 ? 'third' : '';
      const streakClass = s.streak ? 'hot' : 'cold';
      return `
        <tr>
          <td class="rank ${rankClass}">${i + 1}</td>
          <td class="player-name">${s.player}</td>
          <td class="wins">${s.wins}</td>
          <td>${s.seconds}</td>
          <td>${s.thirds}</td>
          <td>${s.avgFinish}</td>
          <td><span class="streak ${streakClass}">${s.streak || '--'}</span></td>
        </tr>
      `;
    }).join('');
  }

  // ========== LAST RACE ==========
  function renderLastRace() {
    const container = document.getElementById('last-race-result');
    if (results.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🏎️</div><p>No races completed yet</p></div>';
      return;
    }
    const last = results[results.length - 1];
    container.innerHTML = renderResultCard(last);
  }

  // ========== RESULTS PAGE ==========
  function renderResults() {
    const grid = document.getElementById('results-grid');
    if (results.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">📊</div><p>Results will show up here after races are scored</p></div>';
      return;
    }
    grid.innerHTML = [...results].reverse().map(r => renderResultCard(r)).join('');
  }

  function renderResultCard(r) {
    const race = schedule.find(s => s.raceId === r.raceId);
    const sorted = [...r.finishOrder].sort((a, b) => a.position - b.position);
    return `
      <div class="result-card">
        <div class="card-header">
          <span class="race-name">${race ? race.name : `Race ${r.raceId}`}</span>
          <span class="race-date">${race ? formatDateShort(race.dateLocal || race.date) : ''}</span>
        </div>
        <div class="card-body">
          ${sorted.map(f => `
            <div class="winner-row ${f.player === r.winner ? 'is-winner' : ''}">
              <span class="position">P${f.position}</span>
              <span class="pick-player">${f.player}</span>
              <span class="pick-driver">${f.driver} #${f.driverNum || '?'}</span>
              <span class="finish">${f.player === r.winner ? '🏆 WINNER' : `P${f.position}`}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ========== SCHEDULE ==========
  function renderSchedule() {
    const list = document.getElementById('schedule-list');
    if (schedule.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="icon">📅</div><p>Loading schedule...</p></div>';
      return;
    }

    const now = new Date();
    let foundNext = false;

    list.innerHTML = schedule.map((r, i) => {
      const raceDate = new Date(r.date);
      const isCompleted = results.some(res => res.raceId === r.raceId);
      const isNext = !foundNext && raceDate > now && !isCompleted;
      if (isNext) foundNext = true;

      const statusClass = isCompleted ? 'completed' : isNext ? 'next' : '';
      const statusBadge = isCompleted
        ? '<span class="race-status complete">Complete</span>'
        : isNext
        ? '<span class="race-status upcoming">Next Up</span>'
        : raceDate < now
        ? '<span class="race-status" style="color:var(--gray)">Past</span>'
        : '<span class="race-status upcoming">Upcoming</span>';

      const winner = isCompleted ? results.find(res => res.raceId === r.raceId) : null;

      return `
        <div class="schedule-item ${statusClass}">
          <span class="race-num">${i + 1}</span>
          <div class="race-details">
            <div class="name">${r.name}</div>
            <div class="track-date">${r.track} &bull; ${formatDateShort(r.dateLocal || r.date)}${winner ? ` &bull; Winner: ${winner.winner}` : ''}</div>
          </div>
          ${statusBadge}
        </div>
      `;
    }).join('');
  }

  // ========== DRIVER USAGE ==========
  function renderDriverUsage() {
    const grid = document.getElementById('usage-grid');

    grid.innerHTML = PLAYERS.map(player => {
      const playerPicks = picks.filter(p => p.player === player);
      const driverCounts = {};
      playerPicks.forEach(p => {
        driverCounts[p.driver] = (driverCounts[p.driver] || 0) + 1;
      });

      const drivers = Object.entries(driverCounts)
        .sort((a, b) => b[1] - a[1]);

      return `
        <div class="usage-card">
          <div class="player-header">${player}</div>
          ${drivers.length === 0 ? '<div style="color:var(--gray);font-size:0.85rem;">No picks yet</div>' : ''}
          ${drivers.map(([driver, count]) => `
            <div class="usage-row">
              <span class="driver-name">${driver}</span>
              <div class="usage-dots">
                ${Array.from({length: MAX_PICKS_PER_DRIVER}, (_, i) => {
                  if (i < count && count >= MAX_PICKS_PER_DRIVER) return '<div class="usage-dot maxed"></div>';
                  if (i < count) return '<div class="usage-dot used"></div>';
                  return '<div class="usage-dot"></div>';
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');
  }

  // ========== ADMIN: DROPDOWNS ==========
  function populateAdminDropdowns() {
    // Race dropdowns
    const raceOptions = schedule.map(r =>
      `<option value="${r.raceId}">${r.name} - ${formatDateShort(r.dateLocal || r.date)}</option>`
    ).join('');

    const adminRace = document.getElementById('admin-race');
    const adminResultsRace = document.getElementById('admin-results-race');
    if (adminRace) adminRace.innerHTML = '<option value="">Select race...</option>' + raceOptions;
    if (adminResultsRace) adminResultsRace.innerHTML = '<option value="">Select race...</option>' + raceOptions;

    // Driver dropdown — common Cup drivers
    loadDriverDropdown();
  }

  async function loadDriverDropdown() {
    const select = document.getElementById('admin-driver');
    if (!select) return;

    // Top Cup Series drivers for 2025
    const drivers = [
      { num: '5', name: 'Kyle Larson' },
      { num: '9', name: 'Chase Elliott' },
      { num: '11', name: 'Denny Hamlin' },
      { num: '12', name: 'Ryan Blaney' },
      { num: '14', name: 'Chase Briscoe' },
      { num: '17', name: 'Chris Buescher' },
      { num: '19', name: 'Martin Truex Jr.' },
      { num: '20', name: 'Christopher Bell' },
      { num: '22', name: 'Joey Logano' },
      { num: '23', name: 'Bubba Wallace' },
      { num: '24', name: 'William Byron' },
      { num: '34', name: 'Michael McDowell' },
      { num: '41', name: 'Ryan Preece' },
      { num: '43', name: 'Erik Jones' },
      { num: '45', name: 'Tyler Reddick' },
      { num: '48', name: 'Alex Bowman' },
      { num: '54', name: 'Ty Gibbs' },
      { num: '99', name: 'Daniel Suárez' },
      { num: '1', name: 'Ross Chastain' },
      { num: '2', name: 'Austin Cindric' },
      { num: '3', name: 'Austin Dillon' },
      { num: '4', name: 'Josh Berry' },
      { num: '6', name: 'Brad Keselowski' },
      { num: '7', name: 'Corey LaJoie' },
      { num: '8', name: 'Kyle Busch' },
      { num: '10', name: 'Noah Gragson' },
      { num: '16', name: 'Shane van Gisbergen' },
      { num: '21', name: 'Harrison Burton' },
      { num: '31', name: 'Daniel Hemric' },
      { num: '42', name: 'John Hunter Nemechek' },
      { num: '47', name: 'Ricky Stenhouse Jr.' },
      { num: '51', name: 'Justin Haley' },
      { num: '71', name: 'Zane Smith' },
      { num: '77', name: 'Carson Hocevar' }
    ].sort((a, b) => a.name.localeCompare(b.name));

    select.innerHTML = '<option value="">Select driver...</option>' +
      drivers.map(d => `<option value="${d.name}" data-num="${d.num}">#${d.num} ${d.name}</option>`).join('');
  }

  // ========== ADMIN: SUBMIT PICK ==========
  function submitPick() {
    const player = document.getElementById('admin-player').value;
    const raceId = parseInt(document.getElementById('admin-race').value);
    const driverSelect = document.getElementById('admin-driver');
    const driver = driverSelect.value;
    const driverNum = driverSelect.selectedOptions[0]?.dataset?.num || '';
    const feedback = document.getElementById('pick-feedback');

    if (!player || !raceId || !driver) {
      feedback.innerHTML = '<span style="color:var(--red)">Fill in all fields</span>';
      return;
    }

    // Check 5-pick limit
    const driverCount = picks.filter(p => p.player === player && p.driver === driver).length;
    if (driverCount >= MAX_PICKS_PER_DRIVER) {
      feedback.innerHTML = `<span style="color:var(--red)">${player} has already used ${driver} ${MAX_PICKS_PER_DRIVER} times!</span>`;
      return;
    }

    // Check if already picked for this race
    const existing = picks.findIndex(p => p.player === player && p.raceId === raceId);
    if (existing >= 0) {
      picks[existing] = { player, raceId, driver, driverNum };
      feedback.innerHTML = `<span style="color:var(--yellow)">Updated ${player}'s pick to ${driver} #${driverNum}</span>`;
    } else {
      picks.push({ player, raceId, driver, driverNum });
      feedback.innerHTML = `<span style="color:var(--green)">Locked! ${player} → ${driver} #${driverNum}</span>`;
    }

    saveLocalData();
    renderAll();
  }

  // ========== ADMIN: FETCH RESULTS ==========
  async function fetchResults() {
    const raceId = parseInt(document.getElementById('admin-results-race').value);
    const feedback = document.getElementById('results-feedback');

    if (!raceId) {
      feedback.innerHTML = '<span style="color:var(--red)">Select a race</span>';
      return;
    }

    feedback.innerHTML = '<span class="spinner"></span> Pulling results from NASCAR...';

    try {
      const resp = await fetch(NASCAR_LIVE_URL(raceId));
      if (!resp.ok) throw new Error(`NASCAR returned ${resp.status}`);

      const data = await resp.json();

      // Check if race is complete
      if (data.flag_state !== 9 && data.lap_number < data.laps_in_race) {
        feedback.innerHTML = `<span style="color:var(--orange)">Race in progress — Lap ${data.lap_number}/${data.laps_in_race}</span>`;
        return;
      }

      // Get finishing order for our picks
      const racePicks = picks.filter(p => p.raceId === raceId);
      if (racePicks.length === 0) {
        feedback.innerHTML = '<span style="color:var(--red)">No picks found for this race</span>';
        return;
      }

      const vehicles = data.vehicles || [];
      const finishOrder = racePicks.map(pick => {
        // Find the driver in results (match by name or number)
        const match = vehicles.find(v =>
          v.driver?.full_name?.toLowerCase().includes(pick.driver.toLowerCase()) ||
          v.vehicle_number === pick.driverNum
        );

        return {
          player: pick.player,
          driver: pick.driver,
          driverNum: pick.driverNum,
          position: match ? match.running_position : 99
        };
      });

      // Determine winner (lowest finishing position)
      finishOrder.sort((a, b) => a.position - b.position);
      const winner = finishOrder[0].player;

      // Save result
      const existingIdx = results.findIndex(r => r.raceId === raceId);
      const result = { raceId, finishOrder, winner };

      if (existingIdx >= 0) {
        results[existingIdx] = result;
      } else {
        results.push(result);
      }

      // Sort results by schedule order
      results.sort((a, b) => {
        const aIdx = schedule.findIndex(s => s.raceId === a.raceId);
        const bIdx = schedule.findIndex(s => s.raceId === b.raceId);
        return aIdx - bIdx;
      });

      saveLocalData();
      renderAll();

      feedback.innerHTML = `<span style="color:var(--green)">🏆 ${winner} wins! ${finishOrder[0].driver} finished P${finishOrder[0].position}</span>`;

      // Celebration!
      Confetti.launch();

    } catch (e) {
      feedback.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
    }
  }

  // ========== LIVE RACE MONITOR ==========
  function toggleLiveMonitor() {
    const btn = document.getElementById('live-toggle');
    if (liveInterval) {
      clearInterval(liveInterval);
      liveInterval = null;
      btn.textContent = 'Start Live Tracking';
      btn.classList.remove('btn-danger');
      btn.classList.add('btn-primary');
      return;
    }

    btn.textContent = 'Stop Tracking';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-danger');
    updateLiveMonitor();
    liveInterval = setInterval(updateLiveMonitor, 30000); // Every 30 seconds
  }

  async function updateLiveMonitor() {
    const monitor = document.getElementById('live-monitor');
    const now = new Date();

    // Find current/most recent race
    const currentRace = schedule.find(r => {
      const rDate = new Date(r.date);
      const diff = now - rDate;
      return diff > -3600000 && diff < 18000000; // Within 1hr before to 5hrs after start
    });

    if (!currentRace) {
      monitor.innerHTML = '<div style="color:var(--gray)">No active race right now</div>';
      return;
    }

    try {
      const resp = await fetch(NASCAR_LIVE_URL(currentRace.raceId));
      if (!resp.ok) throw new Error('Race feed not available');
      const data = await resp.json();

      const racePicks = picks.filter(p => p.raceId === currentRace.raceId);
      const vehicles = data.vehicles || [];

      const livePositions = racePicks.map(pick => {
        const match = vehicles.find(v =>
          v.driver?.full_name?.toLowerCase().includes(pick.driver.toLowerCase()) ||
          v.vehicle_number === pick.driverNum
        );
        return {
          player: pick.player,
          driver: pick.driver,
          position: match ? match.running_position : '?',
          lastLap: match ? match.last_lap_time : '--',
          status: match?.status === 1 ? 'Running' : 'Out'
        };
      }).sort((a, b) => (a.position === '?' ? 99 : a.position) - (b.position === '?' ? 99 : b.position));

      const flagEmoji = data.flag_state === 1 ? '🟢' : data.flag_state === 2 ? '🟡' : data.flag_state === 4 ? '🔴' : data.flag_state === 9 ? '🏁' : '⚪';

      monitor.innerHTML = `
        <div style="margin-bottom:12px; font-size:0.85rem; color:var(--gray)">
          ${flagEmoji} Lap ${data.lap_number}/${data.laps_in_race} &bull; ${currentRace.name} &bull; Updated ${new Date().toLocaleTimeString()}
        </div>
        <table class="standings-table" style="margin-bottom:0">
          <thead><tr><th>Pos</th><th>Player</th><th>Driver</th><th>Status</th></tr></thead>
          <tbody>
            ${livePositions.map(p => `
              <tr>
                <td class="rank" style="color:${p.position <= 5 ? 'var(--green)' : p.position <= 15 ? 'var(--yellow)' : 'var(--white)'}">P${p.position}</td>
                <td class="player-name">${p.player}</td>
                <td>${p.driver}</td>
                <td style="color:${p.status === 'Running' ? 'var(--green)' : 'var(--red)'}">${p.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (e) {
      monitor.innerHTML = `<div style="color:var(--orange)">Waiting for race feed... (${e.message})</div>`;
    }
  }

  // ========== SMS FUNCTIONS ==========
  async function sendPickReminder() {
    const feedback = document.getElementById('text-feedback');
    feedback.innerHTML = '<span class="spinner"></span> Sending pick reminders...';

    try {
      const resp = await fetch('/api/send-reminder', { method: 'POST' });
      const data = await resp.json();
      feedback.innerHTML = `<span style="color:var(--green)">Sent to ${data.sent || 0} players!</span>`;
    } catch (e) {
      feedback.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
    }
  }

  async function sendResultsText() {
    const feedback = document.getElementById('text-feedback');
    if (results.length === 0) {
      feedback.innerHTML = '<span style="color:var(--red)">No results to send</span>';
      return;
    }

    feedback.innerHTML = '<span class="spinner"></span> Sending results...';

    try {
      const lastResult = results[results.length - 1];
      const race = schedule.find(s => s.raceId === lastResult.raceId);
      const resp = await fetch('/api/send-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: lastResult, raceName: race?.name })
      });
      const data = await resp.json();
      feedback.innerHTML = `<span style="color:var(--green)">Results sent!</span>`;
    } catch (e) {
      feedback.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
    }
  }

  async function sendStandingsText() {
    const feedback = document.getElementById('text-feedback');
    feedback.innerHTML = '<span class="spinner"></span> Sending standings...';

    try {
      const resp = await fetch('/api/send-standings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, picks, schedule })
      });
      const data = await resp.json();
      feedback.innerHTML = `<span style="color:var(--green)">Standings sent!</span>`;
    } catch (e) {
      feedback.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
    }
  }

  // ========== HELPERS ==========
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ========== PUBLIC API ==========
  return {
    submitPick,
    fetchResults,
    toggleLiveMonitor,
    sendPickReminder,
    sendResultsText,
    sendStandingsText,
    init
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
