# API Design Documentation

**Base URL**: `/api`

---

## 1. Users

### List All Users
Retrieves a list of all available users.

- **Endpoint**: `GET /users`
- **Response**: Array of User objects.
  ```json
  [
    {
      "id": 1,
      "username": "Alice",
      "created_at": "2024-01-15 10:00:00"
    },
    ...
  ]
  ```

---

## 2. Conversations

### List User Conversations
Fetches all conversations for a specific user, including the count of unread messages.

- **Endpoint**: `GET /conversations`
- **Query Parameters**:
  - `userId` (required): Integer ID of the current user.
- **Response**: Array of Conversation objects.
  ```json
  [
    {
      "id": 1,
      "name": "Alice & Bob Chat",
      "last_read_message_id": 42,
      "participant_user_id": 1,
      "unread_count": 3,
      "last_message": "Hello there!"
    }
  ]
  ```
- **Notes**: `unread_count` excludes messages sent by the user themselves.

### Mark Conversation as Read
Updates the "read cursor" for a user in a conversation to the latest message.

- **Endpoint**: `POST /conversations/:id/read`
- **URL Parameters**:
  - `id`: Conversation ID.
- **Body**:
  ```json
  {
    "userId": 1
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "lastReadMessageId": 50
  }
  ```

---

## 3. Messages

### Get Messages
Retrieves the message history for a conversation. Includes a computed `is_read` status for read receipts.

- **Endpoint**: `GET /conversations/:id/messages`
- **URL Parameters**:
  - `id`: Conversation ID.
- **Query Parameters**:
  - `userId`: Integer ID of the viewing user (used to calculate read status logic).
- **Response**: Array of Message objects.
  ```json
  [
    {
      "id": 45,
      "conversation_id": 1,
      "sender_id": 1,
      "content": "How are you?",
      "created_at": "...",
      "sender_name": "Alice",
      "is_read": 1  // 1 = Read, 0 = Unread
    }
  ]
  ```
- **Logic**: `is_read` is `1` if the message ID is less than or equal to the *other* participant's `last_read_message_id`.

### Send Message
Sends a new message to a conversation. Automatically marks the message as read for the sender.

- **Endpoint**: `POST /messages`
- **Body**:
  ```json
  {
    "conversationId": 1,
    "senderId": 1,
    "content": "Hello World"
  }
  ```
- **Response**: The created Message object.
  ```json
  {
    "id": 51,
    "conversationId": 1,
    "senderId": 1,
    "content": "Hello World",
    "created_at": "..."
  }
  ```
