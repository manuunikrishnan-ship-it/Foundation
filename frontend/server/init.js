const { Pool } = require('pg');

// The password has special characters that might need URL encoding or careful handling.
// Here I'll pass the connection parameters as an object instead of a full connection string to avoid URI parsing issues.

const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.txootmnhfqaxliasvasi',
  password: '*QH6B?6rR%hp!w2',
  ssl: { rejectUnauthorized: false } // Supabase usually requires SSL
});

async function initDb() {
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to database successfully.');

    // Create the reviews table if it doesn't exist
    // Using IF NOT EXISTS so it doesn't fail on re-run
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        student_name VARCHAR(255) NOT NULL,
        batch VARCHAR(100),
        module VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending', 
        scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        scores JSONB DEFAULT '{}', 
        notes TEXT,
        session_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Database initialized successfully: Table "reviews" is ready.');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    if (client) client.release();
    pool.end();
  }
}

initDb();
