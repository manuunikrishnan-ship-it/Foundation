const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Database Configuration
const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.txootmnhfqaxliasvasi',
  password: '*QH6B?6rR%hp!w2',
  ssl: { rejectUnauthorized: false }
});

// GET all reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reviews ORDER BY scheduled_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// GET a single review by ID
app.get('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM reviews WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Review not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// POST schedule a new review
app.post('/api/reviews', async (req, res) => {
  try {
    const { studentName, batch, module, status, scheduledAt } = req.body;
    const result = await pool.query(
      'INSERT INTO reviews (student_name, batch, module, status, scheduled_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [studentName, batch, module, status || 'pending', scheduledAt || new Date()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to schedule review' });
  }
});

// PUT update review status / complete review
app.put('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, scores, notes, session_data } = req.body;
    
    // Dynamically build update query
    let updates = [];
    let values = [];
    let counter = 1;

    if (status) { updates.push(`status = $${counter++}`); values.push(status); }
    if (scores) { updates.push(`scores = $${counter++}`); values.push(scores); }
    if (notes) { updates.push(`notes = $${counter++}`); values.push(notes); }
    if (session_data) { updates.push(`session_data = $${counter++}`); values.push(session_data); }
    
    updates.push(`updated_at = NOW()`);
    values.push(id); // ID is the last param for WHERE clause

    const query = `UPDATE reviews SET ${updates.join(', ')} WHERE id = $${counter} RETURNING *`;
    
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Review not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// DELETE a review
app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
