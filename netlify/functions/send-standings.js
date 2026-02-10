// Send season standings text to all players
const twilio = require('twilio');

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const PLAYER_NAMES = ['Brandon', 'Mom', 'Dad', 'Greg', 'Matt'];

const PHONES = {
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

  const { results } = JSON.parse(event.body);
  if (!results || results.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No results' }) };
  }

  const client = twilio(TWILIO_SID, TWILIO_TOKEN);

  // Calculate wins
  const wins = {};
  PLAYER_NAMES.forEach(p => wins[p] = 0);
  results.forEach(r => {
    if (r.winner && wins[r.winner] !== undefined) wins[r.winner]++;
  });

  const sorted = Object.entries(wins).sort((a, b) => b[1] - a[1]);
  const racesPlayed = results.length;

  const message =
    `🏁 SEASON STANDINGS (${racesPlayed} races) 🏁\n\n` +
    sorted.map(([name, w], i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} ${name}: ${w} wins`;
    }).join('\n') +
    `\n\nGood luck next week!`;

  let sent = 0;
  for (const [name, phone] of Object.entries(PHONES)) {
    if (!phone) continue;
    try {
      await client.messages.create({
        body: message,
        from: TWILIO_NUMBER,
        to: phone
      });
      sent++;
    } catch (e) {
      console.log(`Failed to send to ${name}:`, e.message);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sent })
  };
};
