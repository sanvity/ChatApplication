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

async function debugReadReceipt() {
    console.log("Debugging Read Receipt Logic...");

    try {
        // 1. Get Users
        const users = await request('GET', '/users');
        const alice = users.find(u => u.username === 'Alice');
        const bob = users.find(u => u.username === 'Bob');

        console.log(`Alice ID: ${alice.id}, Bob ID: ${bob.id}`);

        // 2. Alice sends message
        let convsAlice = await request('GET', `/conversations?userId=${alice.id}`);
        console.log("Alice sending message...");
        const msgResponse = await request('POST', '/messages', {
            conversationId: convsAlice[0].id,
            senderId: alice.id,
            content: "Check Read " + Date.now()
        });
        const msgId = msgResponse.id;
        console.log(`Message Sent ID: ${msgId}`);

        // 3. Check Messages (Alice View). Is Read should be 0 (Bob hasn't read)
        // Wait, does Alice reading it count?
        // Logic: "last_read_message_id of the OTHER participant"
        // Other participant is Bob. Bob hasn't read it.
        // So is_read should be 0.
        let messages = await request('GET', `/conversations/${convsAlice[0].id}/messages?userId=${alice.id}`);
        let myMsg = messages.find(m => m.id === msgId);
        console.log(`Alice View (Before Bob Read): is_read = ${myMsg.is_read}`);

        if (myMsg.is_read !== 0) {
            console.error("FAIL: Message marked read before Bob read it!");
        }

        // 4. Bob Reads
        console.log("Bob reading...");
        await request('POST', `/conversations/${convsAlice[0].id}/read`, {
            userId: bob.id
        });

        // 5. Check Messages (Alice View). Is Read should be 1.
        messages = await request('GET', `/conversations/${convsAlice[0].id}/messages?userId=${alice.id}`);
        myMsg = messages.find(m => m.id === msgId);
        console.log(`Alice View (After Bob Read): is_read = ${myMsg.is_read}`);

        if (myMsg.is_read !== 1) {
            console.error("FAIL: Message NOT marked read after Bob read it!");
        } else {
            console.log("SUCCESS: Message marked read.");
        }

        await dumpDb();

    } catch (error) {
        console.error("Test failed:", error);
    }
}

debugReadReceipt();
