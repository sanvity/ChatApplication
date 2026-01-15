# CustomerConversations

----> Approach to store message read status [Database Design]
Option A: read_at on messages
Simple but,
❌ Fails for group chats later
❌ Doesn’t scale well

Option C: message_reads table
Most flexible but,
❌ Overkill for 2 users
❌ More joins, more complexity

✅ Option B (BEST choice): Last read message per user per conversation


KEY POINTS:
--> A message is unread for a user if   "message.id > last_read_message_id"
--> Sender’s own messages are never unread for them


---->LOGIC:
1 Sending a message
2. Fetch conversations with unread counts
3. Open conversation (fetch messages)
4. Mark conversation as read (explicit)
5. Edge cases : Conversation with no messages  
                Opening conversation multiple times
                Sending message to self (ignored or blocked)
                Unread count should never go negative


 Method Endpoint                       Purpose                           
 ------ ------------------------------ --------------------------------- 
 POST   /messages                      Send message                      
 GET    /conversations                 List conversations + unread count 
 GET    /conversations/{id}/messages   View messages                     
 POST   /conversations/{id}/read       Mark read                         



