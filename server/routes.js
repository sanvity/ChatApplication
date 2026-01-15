const express = require('express');
const router = express.Router();
const db = require('./db');

// Get all users
router.get('/users', (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get conversations for a user with unread counts
router.get('/conversations', (req, res) => {
    const userId = parseInt(req.query.userId); // Ensure integer
    if (!userId) return res.status(400).json({ error: "Missing or invalid userId" });

    // Debug logging
    console.log(`Fetching conversations for user ${userId}`);

    const sql = `
        SELECT 
            c.id, 
            c.name,
            p.last_read_message_id,
            p.user_id as participant_user_id,
            (SELECT COUNT(*) FROM messages m 
             WHERE m.conversation_id = c.id 
             AND m.id > p.last_read_message_id
             AND CAST(m.sender_id AS INTEGER) != CAST(p.user_id AS INTEGER)) as unread_count,
            (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message
        FROM conversations c
        JOIN participants p ON c.id = p.conversation_id
        WHERE p.user_id = ?
    `;

    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        console.log("Conversation rows:", rows);
        res.json(rows);
    });
});

// Get messages for a conversation
router.get('/conversations/:id/messages', (req, res) => {
    const conversationId = req.params.id;
    const { limit = 50, beforeId } = req.query; // Basic pagination hooks

    // Calculate is_read: True if the message ID is <= the last_read_message_id of the OTHER participant
    // We assume 2 participants. So we look for any participant who is NOT the sender.
    let sql = `
        SELECT m.*, u.username as sender_name,
        (CASE 
            WHEN m.id <= (
                SELECT MIN(p.last_read_message_id) 
                FROM participants p 
                WHERE p.conversation_id = m.conversation_id 
                AND p.user_id != m.sender_id
            ) THEN 1 
            ELSE 0 
        END) as is_read
        FROM messages m 
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
    `;
    const params = [conversationId];

    if (beforeId) {
        sql += ` AND m.id < ?`;
        params.push(beforeId);
    }

    sql += ` ORDER BY m.id ASC`; // Chronological order

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Send a message
router.post('/messages', (req, res) => {
    const { conversationId, senderId, content } = req.body;
    if (!conversationId || !senderId || !content) {
        return res.status(400).json({ error: "Missing fields" });
    }

    const sql = `INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)`;

    db.run(sql, [conversationId, senderId, content], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const messageId = this.lastID;
        console.log(`Message sent. ID: ${messageId}. Updating participant ${senderId} read status...`);

        // Auto-mark as read for the sender
        const updateReadSql = `
            UPDATE participants 
            SET last_read_message_id = ?, last_read_at = CURRENT_TIMESTAMP
            WHERE conversation_id = ? AND user_id = ?
        `;

        db.run(updateReadSql, [messageId, conversationId, senderId], function (updateErr) {
            if (updateErr) console.error("Failed to update sender read status", updateErr);
            console.log(`Updated sender read status. Changes: ${this.changes}`);

            res.json({
                id: messageId,
                conversationId,
                senderId,
                content,
                created_at: new Date()
            });
        });
    });
});

// Mark conversation as read
router.post('/conversations/:id/read', (req, res) => {
    const conversationId = req.params.id;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // Find the latest message ID in this conversation to set as the read marker
    db.get("SELECT MAX(id) as max_id FROM messages WHERE conversation_id = ?", [conversationId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const lastMessageId = row.max_id || 0;

        const updateSql = `
            UPDATE participants 
            SET last_read_message_id = ?, last_read_at = CURRENT_TIMESTAMP
            WHERE conversation_id = ? AND user_id = ?
        `;

        db.run(updateSql, [lastMessageId, conversationId, userId], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, lastReadMessageId: lastMessageId });
        });
    });
});

module.exports = router;
