// Send pick reminder texts to all players
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POST only' }) };
  }

  const client = twilio(TWILIO_SID, TWILIO_TOKEN);

  // Fetch next race from NASCAR
  let nextRace = 'the next race';
  let track = '';
  try {
    const fetch = (await import('node-fetch')).default;
    const resp = await fetch('https://cf.nascar.com/cacher/2026/1/schedule-feed.json');
    const schedule = await resp.json();
    const now = new Date();
    const races = schedule
      .filter(e => e.run_type === 3 && e.event_name === 'Race')
      .sort((a, b) => new Date(a.start_time_utc) - new Date(b.start_time_utc));
    const next = races.find(r => new Date(r.start_time_utc) > now);
    if (next) {
      nextRace = next.race_name;
      track = next.track_name;
    }
  } catch (e) {
    console.log('Could not fetch schedule:', e.message);
  }

  const message =
    `🏁 NASCAR PICK'EM 🏁\n\n` +
    `Race: ${nextRace}\n` +
    `${track ? `Track: ${track}\n` : ''}` +
    `\nWho's your driver? Reply with a name or car number!\n` +
    `(Example: "Larson" or "5")`;

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
    } catch (e) {
      errors.push({ name, error: e.message });
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sent, errors })
  };
};
