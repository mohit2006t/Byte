const sqlite3 = require('sqlite3').verbose();

// Create a new database file or open an existing one
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error(err.message);
    return;
  }
  console.log('Connected to the SQLite database.');
});

// SQL statement to create the urls table
const createTableSql = `
CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    short_code TEXT UNIQUE NOT NULL,
    long_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`;

// Execute the SQL statement to create the table
db.run(createTableSql, (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Table "urls" created successfully or already exists.');
  }

  // Close the database connection
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Closed the database connection.');
  });
});
