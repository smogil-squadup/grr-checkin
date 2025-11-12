const { Pool } = require('pg');

const dateParam = '2025-11-12';

const query = `
SELECT
  id,
  name,
  ((start_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Chicago')::date as chicago_date,
  $1::date as param_date,
  ((start_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Chicago')::date = $1::date as matches
FROM events
WHERE id = 114470
`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(query, [dateParam]).then(result => {
  console.log(JSON.stringify(result.rows[0], null, 2));
  pool.end();
}).catch(err => {
  console.error('Error:', err.message);
  pool.end();
});
