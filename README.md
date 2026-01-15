# Simple Chat Application

A simple chat application with message read status tracking.

## Features
- **Multi-User Chat**: Support for interactions between multiple users (Alice, Bob, Charlie).
- **Multiple Conversations**: Users can participate in distinct conversation threads.
- **Smart Read Status**:
  - **Unread Count**: Real-time badge on conversation list.
  - **Unread Messages Bar**: A visual divider showing "X Unread Messages" inside the chat.
  - **Read Receipts**:
    - ☑️☑️ **(Grey)✓✓** : Sent by user.
    - ✅✅ **(Green)✓✓** : Read by the recipient.
- **Real-time Updates**: Auto-refresh using efficient short polling.
- **Full Message History**: Persistent storage in SQLite.

## Technical Design
### Database Design & Justification

I prioritized **efficiency and scalability** for the read-status logic.

**Chosen Approach: (Option B) Last read message per user per conversation** </br>
Instead of tracking the status of *every* individual message for *every* user (which leads to massive table growth), this approach tracks a single "cursor" pointer for each user in a conversation.

**Why this design?**
1.  **O(1) Write Efficiency**: Marking a conversation as read involves updating a **single row** in the `participants` table (`last_read_message_id`), regardless of whether there are 1 or 10,000 unread messages.
2.  **Storage Efficiency**: The overhead is constant per participant, not linear with messages.
3.  **Simple Comparison Logic**: A message is "unread" simply if `message.id > user_cursor`.

#### Schema

**1. `users` Table**
Stores user identities.
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**2. `conversations` Table**
Groups messages and participants.
```sql
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**3. `participants` Table** (Crucial for Read Status)
Links users to conversations and tracks their read position.
```sql
CREATE TABLE participants (
    conversation_id INTEGER,
    user_id INTEGER,
    last_read_message_id INTEGER DEFAULT 0, -- The "Cursor" Pointer
    last_read_at DATETIME,
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY(conversation_id) REFERENCES conversations(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);
```

**4. `messages` Table**
Standard storage for chat history.
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER,
    sender_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id),
    FOREIGN KEY(sender_id) REFERENCES users(id)
);
```

### Tech Stack
- **Backend**: Node.js, Express, SQLite.
- **Frontend**: HTML/CSS/JS.

## Setup Instructions

1. **Prerequisites**: Node.js installed.

2. **Install Dependencies**:
   ```bash
   cd server
   npm install
   ```

3. **Start the Application**:
   ```bash
   node server.js
   ```
   The server will start on port 3000 and initialize the SQLite database automatically.

4. **Access the Application**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage
1. Open the application in multiple browser tabs.
2. **Login**: Select a User in each tab (e.g., Tab 1: Alice, Tab 2: Bob, Tab 3: Charlie).
3. **Select Conversation**: Choose a chat from the sidebar (e.g., "Alice & Bob Chat").
4. **Send Message**: Type and send.
   - **Sender View**: Message appears with **☑️☑️**.
   - **Recipient View**: Sidebar shows a Red Badge with count.
5. **Read Message**: Recipient opens the chat.
   - **Recipient View**: Sees a **"Unread Messages"** bar separating new messages.
   - **Sender View**: The ☑️☑️**Grey** turns ✅✅**Green** instantly.
6. **Switch Chats**: Click "Close" or select another conversation to switch context.

## Edge Case Handling
The implementation handles a few common situations that affect read/unread behavior:

- **Empty Conversations**:  
  Conversations with no messages show an unread count of `0`.  
  This is ensured by initializing `last_read_message_id` to `0` for each participant.

- **User's own messages are not counted as Unread**:  
  Messages sent by the current user are never included in their unread count.  
  This is ensured by computing unread messages only where `sender_id ≠ current_user_id`.

- **Repeated opens do not interfere with read status**:  
  Opening the same conversation multiple times does not change the read state incorrectly.  
  This is ensured by updating the read position only to the maximum message ID seen, never moving the cursor backward.



