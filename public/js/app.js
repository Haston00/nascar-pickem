// NASCAR Pick'em — Main App (Supabase synced)
const App = (() => {
  // ========== CONFIG ==========
  const SUPABASE_URL = 'https://tayhcgilczndmnswagom.supabase.co/rest/v1';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRheWhjZ2lsY3puZG1uc3dhZ29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzc3NzQsImV4cCI6MjA4NTk1Mzc3NH0.N7svH4ipeC85JiJtTV2VRQHV8irLNRMziP3GKNjRBhE';
  const NASCAR_SCHEDULE_URL = 'https://cf.nascar.com/cacher/2026/1/schedule-feed.json';
  const NASCAR_LIVE_URL = (raceId) => `https://cf.nascar.com/cacher/live/series_1/${raceId}/live-feed.json`;

  const PLAYERS = ['Brandon', 'Mom', 'Dad', 'Greg', 'Matt'];
  const MAX_PICKS_PER_DRIVER = 5;

  let schedule = [];
  let picks = [];    // { player, raceId, driver, driverNum }
  let results = [];  // { raceId, finishOrder, winner, raceWinner, note }
  let liveInterval = null;

  // ========== SUPABASE HELPERS ==========
  async function db(method, table, query, body) {
    const url = `${SUPABASE_URL}/${table}${query ? '?' + query : ''}`;
    const opts = {
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=representation',
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(url, opts);
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`DB error: ${resp.status} ${err}`);
    }
    const text = await resp.text();
    return text ? JSON.parse(text) : null;
  }

  // ========== PRE-LOADED RESULTS (races before league started) ==========
  const PRELOADED_RESULTS = [
    {
      raceId: 5593,
      raceName: 'Cook Out Clash at Bowman Gray',
      raceWinner: 'Ryan Preece',
      note: 'League not active yet — no picks'
    }
  ];

  // ========== INIT ==========
  async function init() {
    setupNav();
    await loadFromSupabase();
    await seedPreloadedResults();
    await loadSchedule();
  }

  async function loadFromSupabase() {
    try {
      const [dbPicks, dbResults] = await Promise.all([
        db('GET', 'nascar_picks', 'order=created_at.asc'),
        db('GET', 'nascar_results', 'order=race_id.asc'),
      ]);
      picks = (dbPicks || []).map(p => ({
        player: p.player,
        raceId: p.race_id,
        driver: p.driver,
        driverNum: p.driver_num,
      }));
      results = (dbResults || []).map(r => ({
        raceId: r.race_id,
        finishOrder: r.finish_order || [],
        winner: r.winner,
        raceWinner: r.race_winner,
        note: r.note,
      }));
    } catch (e) {
      console.error('Supabase load failed:', e);
    }
  }

  async function seedPreloadedResults() {
    for (const pre of PRELOADED_RESULTS) {
      if (!results.find(r => r.raceId === pre.raceId)) {
        try {
          await db('POST', 'nascar_results', '', {
            race_id: pre.raceId,
            finish_order: [],
            winner: null,
            race_winner: pre.raceWinner,
            note: pre.note,
          });
          results.push({
            raceId: pre.raceId,
            finishOrder: [],
            winner: null,
            raceWinner: pre.raceWinner,
            note: pre.note,
          });
        } catch (e) {
          // Already exists, that's fine
        }
      }
    }
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

  // ========== NASCAR SCHEDULE ==========
  async function loadSchedule() {
    try {
      const resp = await fetch(NASCAR_SCHEDULE_URL);
      if (resp.ok) {
        const data = await resp.json();
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
      }
    } catch (e) {
      console.log('Schedule fetch failed:', e);
    }
    renderAll();
  }

  // ========== RENDER EVERYTHING ==========
  function renderAll() {
    renderNextRace();
    renderStandings();
    renderFrontRowJoe();
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

    updateCountdown(nextRace.date);
    setInterval(() => updateCountdown(nextRace.date), 1000);

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
  // Scoring: 1st picker = 3pts, 2nd = 2pts, 3rd = 1pt, +1 bonus if driver wins the actual race (P1)
  function renderStandings() {
    const stats = PLAYERS.map(player => {
      let points = 0;
      let firsts = 0;
      let seconds = 0;
      let thirds = 0;
      let bonuses = 0;

      results.forEach(r => {
        if (!r.finishOrder || r.finishOrder.length === 0) return;
        const sorted = [...r.finishOrder].sort((a, b) => a.position - b.position);

        // Find this player's rank among pickers
        const playerIdx = sorted.findIndex(f => f.player === player);
        if (playerIdx === -1) return;

        if (playerIdx === 0) { points += 3; firsts++; }
        else if (playerIdx === 1) { points += 2; seconds++; }
        else if (playerIdx === 2) { points += 1; thirds++; }

        // Bonus: +1 if their driver finished P1 in the actual race
        if (sorted[playerIdx].position === 1) { points += 1; bonuses++; }

        // Toilet Paper Pick: +1 if their driver finished dead last in the actual race
        const allPositions = r.finishOrder.map(f => f.position).filter(p => p != null && p !== 99);
        const lastPlace = Math.max(...allPositions);
        if (sorted[playerIdx].position === lastPlace && lastPlace > 1) { points += 1; }
      });

      // Win streak (consecutive 1st place among pickers)
      let streak = '';
      const scoredResults = results.filter(r => r.finishOrder && r.finishOrder.length > 0);
      if (scoredResults.length > 0) {
        let count = 0;
        for (let i = scoredResults.length - 1; i >= 0; i--) {
          const sorted = [...scoredResults[i].finishOrder].sort((a, b) => a.position - b.position);
          if (sorted[0] && sorted[0].player === player) count++;
          else break;
        }
        if (count >= 2) streak = `🔥 ${count}W`;
      }

      return { player, points, firsts, seconds, thirds, bonuses, streak };
    });

    // Sort by points desc, then firsts desc
    stats.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.firsts - a.firsts;
    });

    const tbody = document.getElementById('standings-body');
    tbody.innerHTML = stats.map((s, i) => {
      const rankClass = i === 0 ? 'first' : i === 1 ? 'second' : i === 2 ? 'third' : '';
      const streakClass = s.streak ? 'hot' : 'cold';
      return `
        <tr>
          <td class="rank ${rankClass}">${i + 1}</td>
          <td class="player-name">${s.player}</td>
          <td class="wins" style="font-weight:800;color:var(--yellow)">${s.points}</td>
          <td>${s.firsts}</td>
          <td>${s.seconds}</td>
          <td>${s.thirds}</td>
          <td>${s.bonuses}</td>
          <td><span class="streak ${streakClass}">${s.streak || '--'}</span></td>
        </tr>
      `;
    }).join('');
  }

  // ========== FRONT ROW JOE STANDINGS ==========
  function renderFrontRowJoe() {
    const stats = PLAYERS.map(player => {
      const finishes = [];
      results.forEach(r => {
        if (!r.finishOrder || r.finishOrder.length === 0) return;
        const entry = r.finishOrder.find(f => f.player === player);
        if (entry && entry.position != null && entry.position !== 99) {
          finishes.push(entry.position);
        }
      });

      const races = finishes.length;
      const avg = races > 0 ? (finishes.reduce((a, b) => a + b, 0) / races).toFixed(1) : '--';
      const best = races > 0 ? Math.min(...finishes) : '--';
      const worst = races > 0 ? Math.max(...finishes) : '--';

      return { player, avg, best, worst, races, avgNum: races > 0 ? parseFloat(avg) : 999 };
    });

    stats.sort((a, b) => a.avgNum - b.avgNum);

    const tbody = document.getElementById('frontrow-body');
    tbody.innerHTML = stats.map((s, i) => {
      const rankClass = i === 0 ? 'first' : i === 1 ? 'second' : i === 2 ? 'third' : '';
      return `
        <tr>
          <td class="rank ${rankClass}">${i + 1}</td>
          <td class="player-name">${s.player}</td>
          <td style="font-weight:800;color:var(--yellow)">${s.avg}</td>
          <td style="color:var(--green)">${s.best !== '--' ? 'P' + s.best : '--'}</td>
          <td style="color:var(--red)">${s.worst !== '--' ? 'P' + s.worst : '--'}</td>
          <td>${s.races}</td>
        </tr>
      `;
    }).join('');
  }

  // ========== LAST RACE ==========
  function renderLastRace() {
    const container = document.getElementById('last-race-result');
    const pickedResults = results.filter(r => r.finishOrder && r.finishOrder.length > 0);
    if (pickedResults.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🏎️</div><p>No league results yet — Daytona 500 is up first!</p></div>';
      return;
    }
    const last = pickedResults[pickedResults.length - 1];
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

    if (r.note || sorted.length === 0) {
      return `
        <div class="result-card">
          <div class="card-header">
            <span class="race-name">${race ? race.name : `Race ${r.raceId}`}</span>
            <span class="race-date">${race ? formatDateShort(race.dateLocal || race.date) : ''}</span>
          </div>
          <div class="card-body">
            <div style="padding: 12px 0; text-align: center;">
              <div style="font-size: 0.85rem; color: var(--yellow); font-weight: 700;">Race Winner: ${r.raceWinner || 'N/A'}</div>
              <div style="font-size: 0.8rem; color: var(--gray); margin-top: 4px;">${r.note || 'No league picks'}</div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="result-card">
        <div class="card-header">
          <span class="race-name">${race ? race.name : `Race ${r.raceId}`}</span>
          <span class="race-date">${race ? formatDateShort(race.dateLocal || race.date) : ''}</span>
        </div>
        <div class="card-body">
          ${sorted.map((f, idx) => {
            let pts = idx === 0 ? 3 : idx === 1 ? 2 : idx === 2 ? 1 : 0;
            const bonus = f.position === 1 ? 1 : 0;
            pts += bonus;
            const allPos = r.finishOrder.map(x => x.position).filter(p => p != null && p !== 99);
            const deadLast = Math.max(...allPos);
            const isToiletPaper = f.position === deadLast && deadLast > 1;
            if (isToiletPaper) pts += 1;
            return `
            <div class="winner-row ${idx === 0 ? 'is-winner' : ''}">
              <span class="position">P${f.position}</span>
              <span class="pick-player">${f.player}</span>
              <span class="pick-driver">${f.driver} #${f.driverNum || '?'}</span>
              <span class="finish">${idx === 0 ? '🏆' : ''}${isToiletPaper ? '🧻' : ''} +${pts}pt${pts !== 1 ? 's' : ''}${bonus ? ' (🏁+1)' : ''}${isToiletPaper ? ' TOILET PAPER PICK' : ''}</span>
            </div>
          `}).join('')}
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

      const resultData = isCompleted ? results.find(res => res.raceId === r.raceId) : null;
      const winnerName = resultData ? (resultData.winner || resultData.raceWinner || '') : '';

      return `
        <div class="schedule-item ${statusClass}">
          <span class="race-num">${i + 1}</span>
          <div class="race-details">
            <div class="name">${r.name}</div>
            <div class="track-date">${r.track} &bull; ${formatDateShort(r.dateLocal || r.date)}${winnerName ? ` &bull; Winner: ${winnerName}` : ''}</div>
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
    const raceOptions = schedule.map(r =>
      `<option value="${r.raceId}">${r.name} - ${formatDateShort(r.dateLocal || r.date)}</option>`
    ).join('');

    const adminRace = document.getElementById('admin-race');
    const adminResultsRace = document.getElementById('admin-results-race');
    if (adminRace) adminRace.innerHTML = '<option value="">Select race...</option>' + raceOptions;
    if (adminResultsRace) adminResultsRace.innerHTML = '<option value="">Select race...</option>' + raceOptions;

    loadDriverDropdown();
  }

  async function loadDriverDropdown() {
    const select = document.getElementById('admin-driver');
    if (!select) return;

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
  async function submitPick() {
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
    // If they already picked this race with same driver, that's an update not a new use
    const existingPick = picks.find(p => p.player === player && p.raceId === raceId);
    const isUpdate = existingPick && existingPick.driver === driver;

    if (driverCount >= MAX_PICKS_PER_DRIVER && !isUpdate) {
      feedback.innerHTML = `<span style="color:var(--red)">${player} has already used ${driver} ${MAX_PICKS_PER_DRIVER} times!</span>`;
      return;
    }

    feedback.innerHTML = '<span class="spinner"></span> Saving...';

    try {
      await db('POST', 'nascar_picks', 'on_conflict=player,race_id', {
        player,
        race_id: raceId,
        driver,
        driver_num: driverNum,
      });

      // Update local state
      const existing = picks.findIndex(p => p.player === player && p.raceId === raceId);
      if (existing >= 0) {
        picks[existing] = { player, raceId, driver, driverNum };
        feedback.innerHTML = `<span style="color:var(--yellow)">Updated ${player}'s pick to ${driver} #${driverNum}</span>`;
      } else {
        picks.push({ player, raceId, driver, driverNum });
        feedback.innerHTML = `<span style="color:var(--green)">Locked! ${player} → ${driver} #${driverNum}</span>`;
      }
      renderAll();
    } catch (e) {
      feedback.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
    }
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

      if (data.flag_state !== 9 && data.lap_number < data.laps_in_race) {
        feedback.innerHTML = `<span style="color:var(--orange)">Race in progress — Lap ${data.lap_number}/${data.laps_in_race}</span>`;
        return;
      }

      const racePicks = picks.filter(p => p.raceId === raceId);
      if (racePicks.length === 0) {
        feedback.innerHTML = '<span style="color:var(--red)">No picks found for this race</span>';
        return;
      }

      const vehicles = data.vehicles || [];
      const finishOrder = racePicks.map(pick => {
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

      finishOrder.sort((a, b) => a.position - b.position);
      const winner = finishOrder[0].player;

      // Save to Supabase
      await db('POST', 'nascar_results', '', {
        race_id: raceId,
        finish_order: finishOrder,
        winner,
      });

      // Update local state
      const existingIdx = results.findIndex(r => r.raceId === raceId);
      const result = { raceId, finishOrder, winner };
      if (existingIdx >= 0) {
        results[existingIdx] = result;
      } else {
        results.push(result);
      }

      results.sort((a, b) => {
        const aIdx = schedule.findIndex(s => s.raceId === a.raceId);
        const bIdx = schedule.findIndex(s => s.raceId === b.raceId);
        return aIdx - bIdx;
      });

      renderAll();
      feedback.innerHTML = `<span style="color:var(--green)">🏆 ${winner} wins! ${finishOrder[0].driver} finished P${finishOrder[0].position}</span>`;
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
    liveInterval = setInterval(updateLiveMonitor, 30000);
  }

  async function updateLiveMonitor() {
    const monitor = document.getElementById('live-monitor');
    const now = new Date();

    const currentRace = schedule.find(r => {
      const rDate = new Date(r.date);
      const diff = now - rDate;
      return diff > -3600000 && diff < 18000000;
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
    init
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
