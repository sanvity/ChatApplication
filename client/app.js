const API_URL = '/api';

// State
let currentUser = null;
let currentConversation = null;
let conversations = [];
let pollingInterval = null;

// DOM Elements
const userSelect = document.getElementById('user-select');
const conversationList = document.getElementById('conversation-list');
const chatTitle = document.getElementById('chat-title');
const closeChatBtn = document.getElementById('close-chat-btn');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// Initialize
async function init() {
    await loadUsers();

    userSelect.addEventListener('change', (e) => {
        currentUser = JSON.parse(e.target.value);
        currentConversation = null;
        loadConversations();
        renderChatWindow();
        startPolling();
    });

    closeChatBtn.addEventListener('click', closeChat);

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// Load Users
async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/users`);
        const users = await response.json();

        users.forEach(user => {
            const option = document.createElement('option');
            option.value = JSON.stringify(user);
            option.textContent = user.username;
            userSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Failed to load users', err);
    }
}

// Load Conversations
async function loadConversations() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_URL}/conversations?userId=${currentUser.id}`);
        conversations = await response.json();
        renderConversationList();

        // Auto-select first conversation if none selected
        // Removed per user request: "dont open the chat automatically"
        // if (!currentConversation && conversations.length > 0) {
        //    selectConversation(conversations[0]);
        // }
    } catch (err) {
        console.error('Failed to load conversations', err);
    }
}

// Render Conversation List
function renderConversationList() {
    conversationList.innerHTML = '';

    conversations.forEach(conv => {
        const div = document.createElement('div');
        div.className = `conversation-item ${currentConversation && currentConversation.id === conv.id ? 'active' : ''}`;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = conv.name || `Conversation ${conv.id}`;

        div.appendChild(nameSpan);

        if (conv.unread_count > 0) {
            const badge = document.createElement('span');
            badge.className = 'unread-badge';
            badge.textContent = conv.unread_count;
            div.appendChild(badge);
        }

        div.addEventListener('click', () => {
            selectConversation(conv);
        });

        conversationList.appendChild(div);
    });
}

// Select Conversation
async function selectConversation(conv) {
    currentConversation = conv;
    renderConversationList(); // Update active state
    renderChatWindow();
    await loadMessages();
    await markAsRead();
}

// Close Chat
function closeChat() {
    currentConversation = null;
    renderConversationList();
    renderChatWindow();
}

// Render Chat Window
function renderChatWindow() {
    if (!currentConversation) {
        chatTitle.textContent = 'Select a conversation';
        closeChatBtn.style.display = 'none';
        messagesContainer.innerHTML = '';
        messageInput.disabled = true;
        messageInput.placeholder = "Select a conversation to start chatting...";
        sendBtn.disabled = true;
        return;
    }

    chatTitle.textContent = currentConversation.name || `Conversation ${currentConversation.id}`;
    closeChatBtn.style.display = 'block';
    messageInput.disabled = false;
    messageInput.placeholder = "Type a message...";
    sendBtn.disabled = false;
    // Messages loaded separately
}

// Load Messages
async function loadMessages() {
    if (!currentConversation || !currentUser) return;

    try {
        const response = await fetch(`${API_URL}/conversations/${currentConversation.id}/messages?userId=${currentUser.id}`);
        const messages = await response.json();
        renderMessages(messages);
    } catch (err) {
        console.error('Failed to load messages', err);
    }
}

// Render Messages
function renderMessages(messages) {
    messagesContainer.innerHTML = '';

    // Get the snapshot of last_read_message_id from the currentConversation object
    // This object is NOT updated by polling, so it reflects the state when we opened the chat
    const lastReadId = currentConversation.last_read_message_id || 0;
    let unreadBarInserted = false;

    // Count unread messages to show in bar
    // We can't rely on `currentConversation.unread_count` because that might be stale or updated
    // accurately counting distinct unread messages in this batch is safer
    let unreadCount = 0;
    messages.forEach(msg => {
        if (msg.id > lastReadId && msg.sender_id !== currentUser.id) {
            unreadCount++;
        }
    });

    messages.forEach(msg => {
        // Check if this is the first unread message from another user
        if (!unreadBarInserted && msg.id > lastReadId && msg.sender_id !== currentUser.id) {
            const bar = document.createElement('div');
            bar.className = 'unread-bar';
            bar.textContent = `${unreadCount} Unread Messages`;
            messagesContainer.appendChild(bar);
            unreadBarInserted = true;
        }

        const div = document.createElement('div');
        div.className = `message ${msg.sender_id === currentUser.id ? 'sent' : 'received'}`;

        const contentDiv = document.createElement('div');
        contentDiv.textContent = msg.content;

        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta';

        let timeStr = new Date(msg.created_at).toLocaleTimeString();

        // Read Receipt (Ticks) - Only for sent messages
        if (msg.sender_id === currentUser.id) {
            const tick = document.createElement('span');
            tick.className = `tick ${msg.is_read ? 'read' : 'sent'}`;
            // Double tick for read, single for sent (delivered)
            // User requested double tick for both (grey/green)
            tick.textContent = '✓✓';
            metaDiv.appendChild(document.createTextNode(timeStr));
            metaDiv.appendChild(tick);
        } else {
            // For received messages, show sender name
            metaDiv.textContent = `${msg.sender_name} • ${timeStr}`;
        }

        div.appendChild(contentDiv);
        div.appendChild(metaDiv);
        messagesContainer.appendChild(div);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send Message
async function sendMessage() {
    if (!currentConversation || !currentUser) return;

    const content = messageInput.value.trim();
    if (!content) return;

    try {
        await fetch(`${API_URL}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversationId: currentConversation.id,
                senderId: currentUser.id,
                content
            })
        });

        messageInput.value = '';
        await loadMessages();
        // Optimistically update list if needed, but polling will handle it
    } catch (err) {
        console.error('Failed to send message', err);
    }
}

// Mark as Read
async function markAsRead() {
    if (!currentConversation || !currentUser) return;

    try {
        await fetch(`${API_URL}/conversations/${currentConversation.id}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });

        // Refresh conversations to clear badge
        loadConversations();
    } catch (err) {
        console.error('Failed to mark read', err);
    }
}

// Polling for updates
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(async () => {
        if (!currentUser) return;

        // Refresh conversation list (unread counts) 
        await loadConversations();

        // Refresh messages if open
        if (currentConversation) {
            const response = await fetch(`${API_URL}/conversations/${currentConversation.id}/messages?userId=${currentUser.id}`);
            const messages = await response.json();

            // simple deep comparison to check if we need to re-render
            const needsUpdate = messages.length !== messagesContainer.children.length ||
                messages.some((msg, index) => {
                    // check if read status changed for sent messages
                    if (msg.sender_id === currentUser.id) {
                        // Find existing tick element
                        const msgDiv = messagesContainer.children[index];
                        if (!msgDiv) return true;
                        const tick = msgDiv.querySelector('.tick');
                        if (tick) {
                            const isRead = tick.classList.contains('read');
                            // If msg.is_read is true but class is not read, OR msg.is_read is false and class is read
                            return !!msg.is_read !== isRead;
                        }
                    }
                    return false;
                });

            if (needsUpdate) {
                renderMessages(messages);
                // Only mark as read if it is actually unread? 
                // relying on backend to handle "read" logic safely.
                markAsRead();
            }
        }
    }, 2000); // 2 second poll
}

init();
