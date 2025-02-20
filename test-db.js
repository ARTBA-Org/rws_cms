import pg from 'pg'
const { Pool } = pg

const connectionConfig = {
  connectionString:
    'postgresql://postgres.nwquaemdrfuhafnugbgl:UHB6tySaRY06Lr8g@aws-0-us-west-1.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false,
  },
}

const pool = new Pool(connectionConfig)

async function testConnection() {
  try {
    const client = await pool.connect()
    console.log('Successfully connected to the database! 🎉')

    // Test a simple query
    const result = await client.query('SELECT NOW()')
    console.log('Database time:', result.rows[0].now)

    client.release()
  } catch (err) {
    console.error('Error connecting to the database:', err.message)
    console.error('Full error:', err)
  } finally {
    await pool.end()
  }
}

testConnection()
