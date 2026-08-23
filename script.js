import { pipeline } from 'https://jsdelivr.net';

let generator = null;
let allConversations = {}; 
let currentChatId = null;

// Cleanly connect button functions to your HTML elements
function setupEventListeners() {
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.querySelector('.new-chat-btn');
    const userInput = document.getElementById('user-input');

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    if (newChatBtn) {
        newChatBtn.addEventListener('click', createNewChat);
    }
    if (userInput) {
        userInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }
}

function loadSavedData() {
    const saved = localStorage.getItem('pc_ai_chats');
    if (saved) { allConversations = JSON.parse(saved); }
    renderSidebar();
}

function saveData() {
    localStorage.setItem('pc_ai_chats', JSON.stringify(allConversations));
}

async function initAI() {
    loadSavedData();
    setupEventListeners();
    const statusEl = document.getElementById('status');
    
    try {
        statusEl.innerText = "⏳ Booting Green AI Engine via WebGPU...";
        generator = await pipeline('text-generation', 'onnx-community/Qwen2.5-0.5B-Instruct', {
            device: 'webgpu'
        });
        statusEl.innerText = "🟢 AI Online via PC WebGPU Hardware";
        document.getElementById('send-btn').disabled = false;
    } catch (err) {
        console.warn("WebGPU fallback triggered", err);
        try {
            generator = await pipeline('text-generation', 'onnx-community/Qwen2.5-0.5B-Instruct');
            statusEl.innerText = "🟡 AI Online (CPU Core Mode - Slower)";
            document.getElementById('send-btn').disabled = false;
        } catch (cpuErr) {
            statusEl.innerText = "❌ Script initialization error.";
        }
    }

    if (Object.keys(allConversations).length === 0) { createNewChat(); } 
    else { switchChat(Object.keys(allConversations)[0]); }
}

// Fixed variable mismatch that was breaking new tab generations
function createNewChat() {
    const id = 'chat_' + Date.now();
    allConversations[id] = { title: "New Stream Data", history: [] };
    saveData();
    renderSidebar();
    switchChat(id);
}

function switchChat(id) {
    currentChatId = id;
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.id === id) item.classList.add('active');
    });
    const msgBox = document.getElementById('messages-box');
    msgBox.innerHTML = '<div class="msg ai-msg">System ready. Running fully client-side on your hardware. Enter data stream:</div>';
    
    if (allConversations[id] && allConversations[id].history) {
        allConversations[id].history.forEach(msg => {
            appendMessage(msg.content, msg.role === 'user' ? 'user-msg' : 'ai-msg');
        });
    }
    msgBox.scrollTop = msgBox.scrollHeight;
}

function renderSidebar() {
    const listEl = document.getElementById('chat-list-box');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    Object.keys(allConversations).sort((a,b) => b.split('_')[1] - a.split('_')[1]).forEach(id => {
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.dataset.id = id;
        item.innerText = allConversations[id].title;
        item.onclick = () => switchChat(id);
        if (id === currentChatId) item.classList.add('active');
        listEl.appendChild(item);
    });
}

async function sendMessage() {
    const inputEl = document.getElementById('user-input');
    const prompt = inputEl.value.trim();
    if (!prompt || !generator || !currentChatId) return;

    inputEl.value = '';
    appendMessage(prompt, 'user-msg');
    allConversations[currentChatId].history.push({ role: 'user', content: prompt });

    if (allConversations[currentChatId].title === "New Stream Data") {
        allConversations[currentChatId].title = prompt.substring(0, 22) + (prompt.length > 22 ? '...' : '');
        renderSidebar();
    }

    const aiMessageId = appendMessage("Running algorithms...", 'ai-msg');
    const aiMessageEl = document.getElementById(aiMessageId);

    try {
        const output = await generator(allConversations[currentChatId].history, { 
            max_new_tokens: 250, 
            temperature: 0.6
        });
        const aiReply = output[0].generated_text[output[0].generated_text.length - 1].content;
        aiMessageEl.innerText = aiReply;
        allConversations[currentChatId].history.push({ role: 'assistant', content: aiReply });
        saveData();
    } catch (error) {
        aiMessageEl.innerText = "Runtime Error: " + error.message;
    }
    document.getElementById('messages-box').scrollTop = document.getElementById('messages-box').scrollHeight;
}

function appendMessage(text, className) {
    const msgBox = document.getElementById('messages-box');
    const div = document.createElement('div');
    const id = 'msg-' + Date.now() + Math.random().toString(36).substr(2, 5);
    div.id = id;
    div.className = `msg ${className}`;
    div.innerText = text;
    msgBox.appendChild(div);
    if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
    return id;
}

// Automatically trigger on script injection load
// Manually bind the functions directly to the global window so your HTML can access them
window.initAI = initAI;
window.sendMessage = sendMessage;
window.createNewChat = createNewChat;
window.switchChat = switchChat;

// Execute initialization protocols
window.initAI();
