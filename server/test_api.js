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
                    resolve(data); // In case of non-json response
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

async function runTest() {
    console.log("Starting Backend Tests...");

    // Give server a moment to start up if we were running it programmatically, 
    // but here we assume it's running.

    try {
        // 1. Get Users
        console.log("\n1. Fetching Users...");
        const users = await request('GET', '/users');
        console.log("Users:", users);
        const alice = users.find(u => u.username === 'Alice');
        const bob = users.find(u => u.username === 'Bob');

        if (!alice || !bob) throw new Error("Users not seeded correctly");

        // 2. Get Conversations for Alice
        console.log("\n2. Fetching Conversations for Alice...");
        let convs = await request('GET', `/conversations?userId=${alice.id}`);
        console.log("Conversations:", convs);
        const convId = convs[0].id;

        // 3. Alice sends a message to the conversation
        console.log("\n3. Alice sends a message...");
        const msg1 = await request('POST', '/messages', {
            conversationId: convId,
            senderId: alice.id,
            content: "Hello Bob!"
        });
        console.log("Message sent:", msg1);

        // 4. Bob checks unread count
        console.log("\n4. Bob checks unread count...");
        convs = await request('GET', `/conversations?userId=${bob.id}`);
        const bobConv = convs.find(c => c.id === convId);
        console.log(`Bob's unread count for conv ${convId}: ${bobConv.unread_count}`);

        if (bobConv.unread_count !== 1) console.error("TEST FAILED: Unread count should be 1");
        else console.log("TEST PASSED: Unread count is 1");

        // 5. Bob reads the conversation (fetches messages)
        console.log("\n5. Bob reads messages...");
        const msgs = await request('GET', `/conversations/${convId}/messages?userId=${bob.id}`);
        console.log(`Fetched ${msgs.length} messages.`);

        // 6. Mark conversation as read for Bob
        console.log("\n6. Marking conversation as read for Bob...");
        await request('POST', `/conversations/${convId}/read`, { userId: bob.id });

        // 7. Bob checks unread count again
        console.log("\n7. Bob checks unread count again...");
        convs = await request('GET', `/conversations?userId=${bob.id}`);
        const bobConvAfter = convs.find(c => c.id === convId);
        console.log(`Bob's unread count for conv ${convId}: ${bobConvAfter.unread_count}`);

        if (bobConvAfter.unread_count !== 0) console.error("TEST FAILED: Unread count should be 0");
        else console.log("TEST PASSED: Unread count is 0");

    } catch (error) {
        console.error("Test failed with error:", error);
    }
}

runTest();
