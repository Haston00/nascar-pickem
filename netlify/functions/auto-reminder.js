// Auto Pick Reminder — runs daily at 10 AM ET via Netlify Scheduled Function
// Checks if there's a race tomorrow. If so, texts everyone who hasn't picked yet.

const twilio = require('twilio');

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const PLAYERS = {
  Brandon: process.env.PHONE_BRANDON,
  Mom: process.env.PHONE_MOM,
  Dad: process.env.PHONE_DAD,
  Greg: process.env.PHONE_GREG,
  Matt: process.env.PHONE_MATT
};

// Netlify Scheduled Function — runs daily at 10:00 AM Eastern (15:00 UTC)
exports.config = {
  schedule: "0 15 * * *"
};

exports.handler = async (event) => {
  console.log('Auto-reminder check running at', new Date().toISOString());

  // Fetch NASCAR schedule
  let nextRace = null;
  try {
    const fetch = (await import('node-fetch')).default;
    const resp = await fetch('https://cf.nascar.com/cacher/2026/1/schedule-feed.json');
    const schedule = await resp.json();

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find races — filter to actual race events (not practice/qualifying)
    const races = schedule
      .filter(e => e.run_type === 3 && e.event_name === 'Race')
      .sort((a, b) => new Date(a.start_time_utc) - new Date(b.start_time_utc));

    // Check if any race is tomorrow
    nextRace = races.find(r => {
      const raceDate = new Date(r.start_time_utc);
      return raceDate.toDateString() === tomorrow.toDateString();
    });

    if (!nextRace) {
      // Also check if race is today (for Saturday night races, send morning-of reminder)
      nextRace = races.find(r => {
        const raceDate = new Date(r.start_time_utc);
        return raceDate.toDateString() === now.toDateString();
      });

      if (nextRace) {
        // Race is TODAY — send urgent reminder
        return await sendTexts(nextRace, true);
      }

      console.log('No race tomorrow or today. Skipping.');
      return { statusCode: 200, body: JSON.stringify({ message: 'No race soon' }) };
    }

    return await sendTexts(nextRace, false);

  } catch (e) {
    console.error('Auto-reminder error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

async function sendTexts(race, isRaceDay) {
  const client = twilio(TWILIO_SID, TWILIO_TOKEN);

  const raceDate = new Date(race.start_time_utc);
  const dayName = raceDate.toLocaleDateString('en-US', { weekday: 'long' });
  const timeStr = raceDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York'
  });

  let message;
  if (isRaceDay) {
    message =
      `🏁 RACE DAY! 🏁\n\n` +
      `${race.race_name}\n` +
      `📍 ${race.track_name}\n` +
      `🟢 Green flag: ${timeStr} ET\n\n` +
      `Lock in your pick NOW! Reply with a driver name or car number.\n` +
      `(Example: "Larson" or "5")`;
  } else {
    message =
      `🏁 NASCAR PICK'EM 🏁\n\n` +
      `Tomorrow's race:\n` +
      `${race.race_name}\n` +
      `📍 ${race.track_name}\n` +
      `🟢 ${dayName} at ${timeStr} ET\n\n` +
      `Who's your driver? Reply with a name or car number!\n` +
      `(Example: "Larson" or "5")`;
  }

  let sent = 0;
  const errors = [];

  for (const [name, phone] of Object.entries(PLAYERS)) {
    if (!phone) continue;
    try {
      await client.messages.create({
        body: message,
        from: TWILIO_NUMBER,
        to: phone
      });
      sent++;
      console.log(`Sent to ${name}`);
    } catch (e) {
      errors.push({ name, error: e.message });
      console.error(`Failed to send to ${name}:`, e.message);
    }
  }

  console.log(`Auto-reminder: sent ${sent}, errors: ${errors.length}`);
  return {
    statusCode: 200,
    body: JSON.stringify({ sent, errors, race: race.race_name, isRaceDay })
  };
}
