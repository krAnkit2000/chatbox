import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, remove, onValue, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { firebaseConfig } from './config.js';

// 🔹 Firebase Init
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🔹 DOM Elements
const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const usernameInput = document.getElementById("username");
const joinBtn = document.getElementById("join-btn");
const createChatBtn = document.getElementById("create-chat-btn");
const clearBtn = document.getElementById("clear-btn");
const inputArea = document.getElementById("input-area");
const joinArea = document.getElementById("join-area");
const bottomControls = document.getElementById("bottom-controls");
const chatIdInput = document.getElementById("chat-id");
const currentChatIdDisplay = document.getElementById("current-chat-id");

let username = "";
let chatId = "";
let replyingTo = null;

// Auto delete time (1 min)
const MESSAGE_EXPIRY_TIME = 30 * 1000;
const CHECK_INTERVAL = 10 * 1000;   

// ✅ Touch device detection (reliable)
const isTouchDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Utility: generate random chat id
function generateChatId(len = 6) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// Create chat id
createChatBtn.addEventListener("click", () => {
  const newId = generateChatId(6);
  chatIdInput.value = newId;
  chatIdInput.focus();
});

// Join Chat
// Join Chat
joinBtn.addEventListener("click", () => {
  username = usernameInput.value.trim();
  const providedChatId = chatIdInput.value.trim();

  if (!username) return alert("Please enter your name!");
  if (!providedChatId) return alert("Please enter or create a chat ID to join.");

  chatId = providedChatId;

  // hide the join inputs + buttons area if you have one
  joinArea.style.display = "none";

  // show chat + input areas
  chatBox.style.display = "flex";
  inputArea.style.display = "flex";
  bottomControls.style.display = "flex";

  currentChatIdDisplay.textContent = chatId;

  // show Clear button
  clearBtn.style.display = "block";

  // hide Join and Create buttons
  joinBtn.style.display = "none";
  createChatBtn.style.display = "none";

  chatBox.innerHTML = "";
  listenForMessages(chatId);
  autoDeleteOldMessages(chatId);
  messageInput.focus();
});


// Send message
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  const newMsg = {
    name: username,
    text,
    time: new Date().toLocaleTimeString(),
    timestamp: Date.now(),
    replyTo: replyingTo ? replyingTo.text : null,
    replyUser: replyingTo ? replyingTo.name : null
  };

  push(ref(db, `messages/${chatId}`), newMsg).catch(err => console.error("Push error:", err));

  messageInput.value = "";
  clearReplyMode();
}

// Listen for messages
function listenForMessages(roomId) {
  const messagesRef = ref(db, `messages/${roomId}`);
  onChildAdded(messagesRef, (snapshot) => {
    const msg = snapshot.val();
    const key = snapshot.key;
    addMessage(msg, key);
  });
}

// Add message to UI
function addMessage(msg, key) {
  const div = document.createElement("div");
  div.classList.add("message", msg.name === username ? "user" : "other");

  const replyBlock = msg.replyTo
    ? `
      <div class="reply-block">
        <div class="reply-line"></div>
        <div class="reply-content">
          <strong class="reply-name">${escapeHtml(msg.replyUser)}</strong>
          <p class="reply-text">${escapeHtml(msg.replyTo)}</p>
        </div>
      </div>
    `
    : "";

  div.innerHTML = `
    ${replyBlock}
    <p class="msg-text">${escapeHtml(msg.text)}</p>
    <div class="msg-header">
      <strong class="msg-name">${escapeHtml(msg.name)}</strong>
      <span class="msg-time">${escapeHtml(msg.time)}</span>
      <div>
        ${!isTouchDevice ? '<button class="reply-btn">💬</button>' : ''} 
        ${msg.name === username ? '<button class="delete-btn">⛔</button>' : ''}
      </div>
    </div>
  `;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;

  // 🗑️ Delete message
  if (msg.name === username) {
    const deleteBtn = div.querySelector(".delete-btn");
    deleteBtn?.addEventListener("click", () => {
      if (confirm("Delete this message?")) {
        remove(ref(db, `messages/${chatId}/${key}`))
          .then(() => div.remove())
          .catch(err => console.error("Delete error:", err));
      }
    });
  }

  // 💬 Reply button (desktop)
  if (!isTouchDevice) {
    const replyBtn = div.querySelector(".reply-btn");
    replyBtn?.addEventListener("click", () => {
      setReplyMode(msg);
    });
  }

  // 📱 Swipe reply (mobile)
  if (isTouchDevice) {
    let startX = 0;
    div.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
    });

    div.addEventListener("touchend", (e) => {
      const endX = e.changedTouches[0].clientX;
      if (endX - startX > 80) {  // Swipe right threshold
        setReplyMode(msg);
      }
    });
  }
}

// ✅ Reply UI
function setReplyMode(msg) {
  replyingTo = { name: msg.name, text: msg.text };
  const existing = document.getElementById("reply-preview");
  if (existing) existing.remove();

  const replyDiv = document.createElement("div");
  replyDiv.id = "reply-preview";
  replyDiv.className = "reply-preview";
  replyDiv.innerHTML = `
    <div><strong>${escapeHtml(msg.name)}:</strong> ${escapeHtml(msg.text)}</div>
    <button id="cancel-reply">✖</button>
  `;
  inputArea.prepend(replyDiv);

  document.getElementById("cancel-reply").onclick = clearReplyMode;
}

function clearReplyMode() {
  replyingTo = null;
  const existing = document.getElementById("reply-preview");
  if (existing) existing.remove();
}

// 🕒 Auto delete messages older than expiry
function autoDeleteOldMessages(chatId) {
  const chatRef = ref(db, `messages/${chatId}`);

  const checkAndDelete = (snapshot) => {
    if (snapshot.exists()) {
      const now = Date.now();
      snapshot.forEach((child) => {
        const msg = child.val();
        if (msg.timestamp && now - msg.timestamp > MESSAGE_EXPIRY_TIME) {
          remove(ref(db, `messages/${chatId}/${child.key}`))
            .then(() => console.log(`🗑️ Deleted old message: ${child.key}`))
            .catch(err => console.error("Auto-delete error:", err));
        }
      });
    }
  };

  onValue(chatRef, (snapshot) => checkAndDelete(snapshot));
  setInterval(async () => {
    const snapshot = await get(chatRef);
    checkAndDelete(snapshot);
  }, CHECK_INTERVAL);
}

// 🧹 Clear Chat
clearBtn.addEventListener("click", () => {
  if (!chatId) return alert("No chat joined.");
  if (!confirm("Are you sure you want to delete all messages in this chat?")) return;
  remove(ref(db, `messages/${chatId}`))
    .then(() => {
      chatBox.innerHTML = "";
      alert("All messages deleted in chat: " + chatId);
    })
    .catch(err => console.error("Error deleting messages:", err));
});

// Escape HTML
function escapeHtml(unsafe) {
  if (unsafe == null) return "";
  return unsafe
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
