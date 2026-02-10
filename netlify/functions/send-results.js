// Send race results text to all players
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

  const { result, raceName } = JSON.parse(event.body);
  if (!result) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No result data' }) };
  }

  const client = twilio(TWILIO_SID, TWILIO_TOKEN);
  const sorted = [...result.finishOrder].sort((a, b) => a.position - b.position);

  const message =
    `🏁 RESULTS: ${raceName || 'Race'} 🏁\n\n` +
    `🏆 ${result.winner} WINS!\n\n` +
    sorted.map((f, i) => {
      const trophy = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${trophy} ${f.player} — ${f.driver} (P${f.position})`;
    }).join('\n') +
    `\n\nText "standings" for season scores!`;

  let sent = 0;
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
      console.log(`Failed to send to ${name}:`, e.message);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sent })
  };
};
