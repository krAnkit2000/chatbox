import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, remove, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
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

// Auto delete time (12 hours)
// const MESSAGE_EXPIRY_TIME = 12 * 60 * 60 * 1000; // 12 hours in ms
const MESSAGE_EXPIRY_TIME = 1 * 60 * 1000; // 1 minute in milliseconds

// Utility: generate a short random chat id (6 chars)
function generateChatId(len = 6) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// 🔹 Create new chat id button
createChatBtn.addEventListener("click", () => {
  const newId = generateChatId(6);
  chatIdInput.value = newId;
  chatIdInput.focus();
});

// 🔹 Join Chat
joinBtn.addEventListener("click", () => {
  username = usernameInput.value.trim();
  const providedChatId = chatIdInput.value.trim();

  if (!username) return alert("Please enter your name!");
  if (!providedChatId) return alert("Please enter or create a chat ID to join.");

  chatId = providedChatId;

  // Hide the entire join area (inputs + create/join buttons)
  joinArea.style.display = "none";

  // Show chat UI
  chatBox.style.display = "flex";
  inputArea.style.display = "flex";
  bottomControls.style.display = "flex";

  currentChatIdDisplay.textContent = chatId;
  clearBtn.style.display = "block";

  chatBox.innerHTML = ""; // clear any previous messages

  listenForMessages(chatId);
  autoDeleteOldMessages(chatId); // ✅ start auto delete check

  messageInput.focus();
});

// 🔹 Send Message
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  // push message to room-specific path
  push(ref(db, `messages/${chatId}`), {
    name: username,
    text,
    time: new Date().toLocaleTimeString(),
    timestamp: Date.now() // ✅ store exact time for expiry
  }).catch(err => console.error("Push error:", err));

  messageInput.value = "";
}

// 🔹 Listen for messages in the chosen chat room
function listenForMessages(roomId) {
  const messagesRef = ref(db, `messages/${roomId}`);
  onChildAdded(messagesRef, (snapshot) => {
    const msg = snapshot.val();
    const key = snapshot.key;
    addMessage(msg, key);
  });
}

// 🔹 Add message to chat box
function addMessage(msg, key) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(msg.name === username ? "user" : "other");

  div.innerHTML = `
    <p class="msg-text">${escapeHtml(msg.text)}</p>
    <div class="msg-header">
      <strong class="msg-name">${escapeHtml(msg.name)}</strong>
      <span class="msg-time">${escapeHtml(msg.time)}</span>
      ${msg.name === username ? '<button class="delete-btn">🪣</button>' : ''}
    </div>
  `;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Delete button logic (delete only from the current room path)
  if (msg.name === username) {
    const deleteBtn = div.querySelector(".delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        if (confirm("Delete this message?")) {
          remove(ref(db, `messages/${chatId}/${key}`))
            .then(() => div.remove())
            .catch(err => console.error("Delete error:", err));
        }
      });
    }
  }
}


function autoDeleteOldMessages(chatId) {
  const chatRef = ref(db, `messages/${chatId}`);

  // Pehli baar load hone par bhi check kare
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

  // Firebase ke data change hone par bhi run hoga
  onValue(chatRef, (snapshot) => {
    checkAndDelete(snapshot);
  });

  // Har 30 seconds me bhi check kare (backup timer)
  setInterval(async () => {
    const snapshot = await (await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js")).get(chatRef);
    if (snapshot.exists()) {
      checkAndDelete(snapshot);
    }
  }, 30000); // 30 seconds
}


// 🔹 Clear chat for current room only (both locally & on Firebase)
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

// 🔹 Escape unsafe HTML
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
