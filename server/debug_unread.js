const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const http = require('http');

function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

function dumpDb() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(path.resolve(__dirname, 'chat.db'), sqlite3.OPEN_READONLY, (err) => {
            if (err) return reject(err);
        });

        console.log("\n--- DB DUMP ---");
        db.serialize(() => {
            db.all("SELECT * FROM participants", [], (err, rows) => {
                console.log("Participants:", rows);
                db.all("SELECT * FROM messages", [], (err, msgs) => {
                    console.log("Messages:", msgs);
                    db.close();
                    resolve();
                });
            });
        });
    });
}

async function debugUnread() {
    console.log("Debugging Unread Logic...");

    try {
        // 1. Get Users
        const users = await request('GET', '/users');
        const alice = users.find(u => u.username === 'Alice');
        const bob = users.find(u => u.username === 'Bob');

        console.log(`Alice ID: ${alice.id}, Bob ID: ${bob.id}`);

        // 2. Initial State
        let convsAlice = await request('GET', `/conversations?userId=${alice.id}`);
        console.log(`Alice Unread (Initial): ${convsAlice[0].unread_count}`);

        // 3. User sends message
        console.log("Alice sending message...");
        await request('POST', '/messages', {
            conversationId: convsAlice[0].id,
            senderId: alice.id,
            content: "Debug Message " + Date.now()
        });

        // 4. Check Alice Unread
        convsAlice = await request('GET', `/conversations?userId=${alice.id}`);
        console.log(`Alice Response Row:`, JSON.stringify(convsAlice[0], null, 2));
        console.log(`Alice Unread (After Send): ${convsAlice[0].unread_count}`);

        if (convsAlice[0].unread_count !== 0) {
            console.error("FAIL: Alice sees unread count for her own message!");
        } else {
            console.log("SUCCESS: Alice count is 0.");
        }

        // Dump DB to see truth
        await dumpDb();

    } catch (error) {
        console.error("Test failed:", error);
    }
}

debugUnread();
