const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; // Changed variable name and used PORT

// Connect to the SQLite database
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error connecting to the database:', err.message);
    // Exit the process if DB connection fails, as the app is unusable.
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');
});

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Function to generate a random alphanumeric short code
function generateShortCode(length = 7) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

// POST /shorten - Create a short URL
app.post('/shorten', async (req, res) => {
  const { long_url } = req.body;

  if (!long_url) {
    return res.status(400).json({ error: 'Missing long_url in request body' });
  }

  // Basic URL validation (can be improved)
  try {
    new URL(long_url);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  let short_code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loop in case of collision saturation

  try {
    while (!isUnique && attempts < maxAttempts) {
      short_code = generateShortCode();
      const row = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM urls WHERE short_code = ?', [short_code], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
      if (!row) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      console.error('Could not generate a unique short code after multiple attempts.');
      return res.status(500).json({ error: 'Failed to generate a unique short code' });
    }

    const insertSql = 'INSERT INTO urls (long_url, short_code) VALUES (?, ?)';
    db.run(insertSql, [long_url, short_code], function(err) {
      if (err) {
        console.error('Error inserting URL into database:', err.message);
        return res.status(500).json({ error: 'Failed to shorten URL' });
      }

      const protocol = 'http'; // As per requirements, hardcode to http for now
      // Determine hostname: use HOST env var, then request host header, then fallback to 'localhost'
      const hostname = process.env.HOST || req.headers.host || 'localhost';
      // Determine port string: include only if not standard port 80 for http or 443 for https
      // For this task, we will always include the PORT if it's not 80 for http.
      // process.env.PORT is a string, PORT variable is a number.
      const currentPort = parseInt(process.env.PORT || '3000', 10); // Ensure PORT is number for comparison
      const portString = (currentPort === 80 && protocol === 'http') ? '' : `:${currentPort}`;

      const baseUrl = `${protocol}://${hostname.replace(/:\d+$/, '')}${portString}`; // Remove existing port from hostname if present
      const fullShortUrl = `${baseUrl}/${short_code}`;

      res.status(201).json({ short_url: fullShortUrl });
    });
  } catch (dbError) {
    console.error('Database error during /shorten:', dbError.message);
    return res.status(500).json({ error: 'Server error during URL shortening' });
  }
});

// GET /:short_code - Redirect to the long URL
app.get('/:short_code', (req, res) => {
  const { short_code } = req.params;

  if (!short_code) {
    return res.status(400).json({ error: 'Short code cannot be empty' });
  }

  const selectSql = 'SELECT long_url FROM urls WHERE short_code = ?';
  db.get(selectSql, [short_code], (err, row) => {
    if (err) {
      console.error('Database error during GET /:short_code:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }

    if (row && row.long_url) {
      // Found the long URL, perform the redirect
      res.redirect(301, row.long_url);
    } else {
      // Short code not found
      res.status(404).json({ error: 'Short URL not found' });
    }
  });
});

// Basic server start
app.listen(PORT, () => { // Used PORT
  console.log(`Server running on port ${PORT}`); // Used PORT
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Closed the database connection.');
    process.exit(0);
  });
});
