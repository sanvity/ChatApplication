# Database Schema

The application uses **SQLite** for data storage. The schema consists of four main tables designed to handle users, conversations, messages, and efficient read status tracking.

## Tables

### 1. `users`
Stores user identities.
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. `conversations`
Represents a chat thread between participants.
```sql
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3. `messages`
Stores the actual chat content.
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

### 4. `participants` (Core Read Status Logic)
Links users to conversations and tracks their **read cursor**.
- `last_read_message_id`: The ID of the last message the user has seen.
- **Logic**: Any message with `ID > last_read_message_id` is considered **Unread**.
```sql
CREATE TABLE participants (
    conversation_id INTEGER,
    user_id INTEGER,
    last_read_message_id INTEGER DEFAULT 0, -- The "Watermark" Pointer
    last_read_at DATETIME,
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY(conversation_id) REFERENCES conversations(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);
```
