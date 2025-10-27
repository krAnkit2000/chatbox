import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, remove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
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
const clearBtn = document.getElementById("clear-btn");
const inputArea = document.getElementById("input-area");

let username = "";

// 🔹 Join Chat




joinBtn.addEventListener("click", () => {
  username = usernameInput.value.trim();
  if (!username) return alert("Please enter your name!");

  document.querySelector(".name-area").style.display = "none";
  chatBox.style.display = "flex";
  inputArea.style.display = "flex";

  // Clear button show karna yahan
  document.getElementById("clear-btn").style.display = "block";

  listenForMessages();
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

  push(ref(db, "messages"), {
    name: username,
    text,
    time: new Date().toLocaleTimeString()
  });

  messageInput.value = "";
}

// 🔹 Listen for messages
function listenForMessages() {
  const messagesRef = ref(db, "messages");
  onChildAdded(messagesRef, (snapshot) => {
    const msg = snapshot.val();
    const key = snapshot.key; // 🔹 Firebase key
    addMessage(msg, key);
  });
}

// 🔹 Add message to chat box
function addMessage(msg, key) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(msg.name === username ? "user" : "other");
div.innerHTML = `
 <p class="msg-text">${msg.text}</p>
  <div class="msg-header">
    <strong class="msg-name">${msg.name}</strong>
    <span class="msg-time">${msg.time}</span>
    ${msg.name === username ? '<button class="delete-btn">🪣</button>' : ''}
  </div>
 
`;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Delete button logic
  if (msg.name === username) {
    const deleteBtn = div.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", () => {
      if (confirm("Delete this message?")) {
        remove(ref(db, `messages/${key}`))
          .catch(err => console.error("Delete error:", err));
        div.remove();
      }
    });
  }
}

// 🔹 Clear chat both locally & on Firebase
clearBtn.addEventListener("click", () => {
  if (!confirm("Are you sure you want to delete all messages?")) return;
  remove(ref(db, "messages"))
    .then(() => {
      chatBox.innerHTML = "";
      alert("All messages deleted!");
    })
    .catch(err => console.error("Error deleting messages:", err));
});
