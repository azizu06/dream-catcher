import express from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../config/database.js';
import { getDreamInterpretation } from '../utils/ai-openai.js'; // or '../utils/ai-gemini.js' for Gemini
import { validateText } from '../utils/validateText.js'

const router = express.Router();
const maxCreateRequests = Number(process.env.DREAM_CREATE_RATE_LIMIT_MAX || 3);
const createRateLimitWindowMs = Number(process.env.DREAM_CREATE_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const dailyDreamLimit = Number(process.env.DAILY_DREAM_AI_LIMIT || 10);

let dailyUsage = {
  day: new Date().toISOString().slice(0, 10),
  count: 0,
};

function resetDailyUsageIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyUsage.day !== today) {
    dailyUsage = { day: today, count: 0 };
  }
}

const createDreamLimiter = rateLimit({
  windowMs: createRateLimitWindowMs,
  max: maxCreateRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many dream interpretation requests. Please try again later.',
    type: 'rate_limit',
  },
});

// Get all dreams
router.get('/', async (req, res) => {
  console.log('GET /api/dreams received');
  try {
    const result = await pool.query('SELECT * FROM dreams ORDER BY created_at DESC');
    console.log('Fetched', result.rows.length, 'dreams');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching dreams:', error);
    res.status(500).json({ error: 'Failed to fetch dreams' });
  }
});

// Get single dream
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dreams WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dream not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching dream:', error);
    res.status(500).json({ error: 'Failed to fetch dream' });
  }
});

// Create new dream with AI interpretation
router.post('/', createDreamLimiter, async (req, res) => {
  console.log('POST /api/dreams received');
  console.log('Request body:', req.body);

  const { dream_text } = req.body;

  resetDailyUsageIfNeeded();
  if (dailyUsage.count >= dailyDreamLimit) {
    return res.status(429).json({
      error: 'The daily dream interpretation limit has been reached. Please try again tomorrow.',
      type: 'daily_limit',
    });
  }

  // Validate input
  const validation = validateText(dream_text);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error, type: 'validation' });
  }

  try {
    let interpretation;
    try {
      interpretation = await getDreamInterpretation(validation.value);
    } catch (aiError) {
      console.error('AI interpretation failed:', aiError);
      return res.status(503).json({ 
        error: 'AI service temporarily unavailable.',
        type: 'ai_error'
      });
    }
    
    console.log('AI interpretation received, inserting into database...');
    dailyUsage.count += 1;

    // Insert into database and return the created dream
    const result = await pool.query(
      'INSERT INTO dreams (dream_text, interpretation) VALUES ($1, $2) RETURNING *',
      [validation.value, interpretation]
    );
    
    console.log('Dream created successfully:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating dream:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to save dream. Please try again.', type: 'database_error' });
  }
});

// Delete dream
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM dreams WHERE id = $1', [req.params.id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Dream not found' });
    }
    
    res.json({ message: 'Dream deleted successfully' });
  } catch (error) {
    console.error('Error deleting dream:', error);
    res.status(500).json({ error: 'Failed to delete dream' });
  }
});

export default router;
