const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'chat.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Conversations Table
        db.run(`CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Messages Table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER,
            sender_id INTEGER,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(conversation_id) REFERENCES conversations(id),
            FOREIGN KEY(sender_id) REFERENCES users(id)
        )`);

        // Participants Table (For read status tracking - Option B)
        db.run(`CREATE TABLE IF NOT EXISTS participants (
            conversation_id INTEGER,
            user_id INTEGER,
            last_read_message_id INTEGER DEFAULT 0,
            last_read_at DATETIME,
            PRIMARY KEY (conversation_id, user_id),
            FOREIGN KEY(conversation_id) REFERENCES conversations(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Seed Initial Data
        seedData();
    });
}

function seedData() {
    db.get("SELECT count(*) as count FROM users", [], (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
            console.log("Seeding data...");
            const stmt = db.prepare("INSERT INTO users (username) VALUES (?)");
            stmt.run("Alice");
            stmt.run("Bob");
            stmt.run("Charlie");
            stmt.finalize();

            // Create a default conversation between Alice and Bob
            db.run("INSERT INTO conversations (name) VALUES (?)", ["Alice & Bob Chat"], function (err) {
                if (!err) {
                    const convId = this.lastID;
                    const pStmt = db.prepare("INSERT INTO participants (conversation_id, user_id) VALUES (?, ?)");
                    pStmt.run(convId, 1); // Alice
                    pStmt.run(convId, 2); // Bob
                    pStmt.finalize();
                }
            });
        }
    });
}

module.exports = db;
