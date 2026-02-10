// Twilio SMS Webhook — handles incoming texts (pick submissions)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// Player phone number mapping
const PHONE_MAP = {
  // Set these in Netlify env vars: PHONE_BRANDON, PHONE_MOM, etc.
  [process.env.PHONE_BRANDON]: 'Brandon',
  [process.env.PHONE_MOM]: 'Mom',
  [process.env.PHONE_DAD]: 'Dad',
  [process.env.PHONE_GREG]: 'Greg',
  [process.env.PHONE_MATT]: 'Matt'
};

// Common driver aliases
const DRIVER_ALIASES = {
  'larson': { name: 'Kyle Larson', num: '5' },
  'kyle larson': { name: 'Kyle Larson', num: '5' },
  '5': { name: 'Kyle Larson', num: '5' },
  'elliott': { name: 'Chase Elliott', num: '9' },
  'chase elliott': { name: 'Chase Elliott', num: '9' },
  'chase': { name: 'Chase Elliott', num: '9' },
  '9': { name: 'Chase Elliott', num: '9' },
  'hamlin': { name: 'Denny Hamlin', num: '11' },
  'denny': { name: 'Denny Hamlin', num: '11' },
  '11': { name: 'Denny Hamlin', num: '11' },
  'blaney': { name: 'Ryan Blaney', num: '12' },
  '12': { name: 'Ryan Blaney', num: '12' },
  'briscoe': { name: 'Chase Briscoe', num: '14' },
  '14': { name: 'Chase Briscoe', num: '14' },
  'buescher': { name: 'Chris Buescher', num: '17' },
  '17': { name: 'Chris Buescher', num: '17' },
  'truex': { name: 'Martin Truex Jr.', num: '19' },
  'martin truex': { name: 'Martin Truex Jr.', num: '19' },
  '19': { name: 'Martin Truex Jr.', num: '19' },
  'bell': { name: 'Christopher Bell', num: '20' },
  '20': { name: 'Christopher Bell', num: '20' },
  'logano': { name: 'Joey Logano', num: '22' },
  'joey': { name: 'Joey Logano', num: '22' },
  '22': { name: 'Joey Logano', num: '22' },
  'wallace': { name: 'Bubba Wallace', num: '23' },
  'bubba': { name: 'Bubba Wallace', num: '23' },
  '23': { name: 'Bubba Wallace', num: '23' },
  'byron': { name: 'William Byron', num: '24' },
  '24': { name: 'William Byron', num: '24' },
  'mcdowell': { name: 'Michael McDowell', num: '34' },
  '34': { name: 'Michael McDowell', num: '34' },
  'reddick': { name: 'Tyler Reddick', num: '45' },
  'tyler reddick': { name: 'Tyler Reddick', num: '45' },
  '45': { name: 'Tyler Reddick', num: '45' },
  'bowman': { name: 'Alex Bowman', num: '48' },
  '48': { name: 'Alex Bowman', num: '48' },
  'gibbs': { name: 'Ty Gibbs', num: '54' },
  'ty gibbs': { name: 'Ty Gibbs', num: '54' },
  '54': { name: 'Ty Gibbs', num: '54' },
  'suarez': { name: 'Daniel Suárez', num: '99' },
  'daniel suarez': { name: 'Daniel Suárez', num: '99' },
  '99': { name: 'Daniel Suárez', num: '99' },
  'chastain': { name: 'Ross Chastain', num: '1' },
  'ross': { name: 'Ross Chastain', num: '1' },
  '1': { name: 'Ross Chastain', num: '1' },
  'cindric': { name: 'Austin Cindric', num: '2' },
  '2': { name: 'Austin Cindric', num: '2' },
  'dillon': { name: 'Austin Dillon', num: '3' },
  '3': { name: 'Austin Dillon', num: '3' },
  'berry': { name: 'Josh Berry', num: '4' },
  '4': { name: 'Josh Berry', num: '4' },
  'keselowski': { name: 'Brad Keselowski', num: '6' },
  'brad': { name: 'Brad Keselowski', num: '6' },
  '6': { name: 'Brad Keselowski', num: '6' },
  'lajoie': { name: 'Corey LaJoie', num: '7' },
  '7': { name: 'Corey LaJoie', num: '7' },
  'busch': { name: 'Kyle Busch', num: '8' },
  'kyle busch': { name: 'Kyle Busch', num: '8' },
  '8': { name: 'Kyle Busch', num: '8' },
  'gragson': { name: 'Noah Gragson', num: '10' },
  '10': { name: 'Noah Gragson', num: '10' },
  'van gisbergen': { name: 'Shane van Gisbergen', num: '16' },
  'svg': { name: 'Shane van Gisbergen', num: '16' },
  '16': { name: 'Shane van Gisbergen', num: '16' },
  'burton': { name: 'Harrison Burton', num: '21' },
  '21': { name: 'Harrison Burton', num: '21' },
  'stenhouse': { name: 'Ricky Stenhouse Jr.', num: '47' },
  '47': { name: 'Ricky Stenhouse Jr.', num: '47' },
  'hocevar': { name: 'Carson Hocevar', num: '77' },
  '77': { name: 'Carson Hocevar', num: '77' }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Parse Twilio form data
  const params = new URLSearchParams(event.body);
  const from = params.get('From');
  const body = (params.get('Body') || '').trim().toLowerCase();

  const player = PHONE_MAP[from];
  if (!player) {
    return twilioResponse("Sorry, this number isn't registered for NASCAR Pick'em!");
  }

  // Handle commands
  if (body === 'standings' || body === 'scores') {
    return twilioResponse("Check standings at the website! Text a driver name or number to make your pick.");
  }

  if (body === 'help') {
    return twilioResponse(
      "NASCAR Pick'em!\n" +
      "- Text a driver name (like 'Larson') or number (like '5') to pick\n" +
      "- Text 'standings' for the link\n" +
      "- Max 5 picks per driver per season"
    );
  }

  // Try to match driver
  const driver = DRIVER_ALIASES[body];
  if (!driver) {
    // Try partial match
    const partial = Object.entries(DRIVER_ALIASES).find(([key]) =>
      key.includes(body) || body.includes(key)
    );
    if (partial) {
      return await processPick(player, partial[1]);
    }
    return twilioResponse(
      `Hmm, I don't recognize "${body}". Try a driver's last name (like "Larson") or car number (like "5").`
    );
  }

  return await processPick(player, driver);
};

async function processPick(player, driver) {
  // For now, respond with confirmation
  // Full Supabase integration will check limits and save
  return twilioResponse(
    `Got it ${player}! Your pick: ${driver.name} #${driver.num}\n\nGood luck! 🏁`
  );
}

function twilioResponse(message) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message}</Message>
</Response>`
  };
}
