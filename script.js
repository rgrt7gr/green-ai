import { pipeline, env } from 'https://jsdelivr.net';

// STRICT OVERRIDE: Tells the library to never try fetching files from the web
env.allowLocalModels = true;
env.allowRemoteModels = false;

let generator = null;
let allConversations = {}; 
let currentChatId = null;

function loadSavedData() {
    try {
        const saved = localStorage.getItem('local_offline_chats');
        if (saved) { allConversations = JSON.parse(saved); }
    } catch (e) {
        console.error("Local registry fetch error:", e);
    }
    renderSidebar();
}

function saveData() {
    localStorage.setItem('local_offline_chats', JSON.stringify(allConversations));
}

async function initAI() {
    loadSavedData();
    const statusEl = document.getElementById('status');
    const sendBtn = document.getElementById('send-btn');
    
    try {
        if (statusEl) statusEl.innerText = "⏳ Reading Local Neural Assets from /model/ Folder...";
        
        // This targets the relative folder structure exactly where your downloads live
        generator = await pipeline('text-generation', './model/', {
            device: 'webgpu',
            model_file_name: 'onnx/model_quantized.onnx' // Points directly to your downloaded 512MB weight file
        });
        
        if (statusEl) statusEl.innerText = "🟢 AI Online Natively (WebGPU Accelerated)";
        if (sendBtn) sendBtn.disabled = false; 
    } catch (err) {
        console.warn("WebGPU initialization fallback triggered, checking CPU...", err);
        try {
            generator = await pipeline('text-generation', './model/', {
                model_file_name: 'onnx/model_quantized.onnx'
            });
            if (statusEl) statusEl.innerText = "🟡 AI Online Natively (CPU Core Mode)";
            if (sendBtn) sendBtn.disabled = false;
        } catch (cpuErr) {
            if (statusEl) statusEl.innerText = "❌ Error: Cannot find local model assets inside /model/ folder.";
            console.error(cpuErr);
        }
    }

    if (Object.keys(allConversations).length === 0) { 
        createNewChat(); 
    } else { 
        switchChat(Object.keys(allConversations)); 
    }
}

function createNewChat() {
    const id = 'chat_' + Date.now();
    allConversations[id] = { title: "New Stream Data", history: [] };
    saveData();
    renderSidebar();
    switchChat(id);
}

function switchChat(id) {
    if (!id || !allConversations[id]) return;
    currentChatId = id;
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.id === id) item.classList.add('active');
    });
    
    const msgBox = document.getElementById('messages-box');
    if (msgBox) {
        msgBox.innerHTML = '<div class="msg ai-msg">System ready. Running fully client-side from local project directory folders. Enter data stream:</div>';
        if (allConversations[id].history) {
            allConversations[id].history.forEach(msg => {
                appendMessage(msg.content, msg.role === 'user' ? 'user-msg' : 'ai-msg');
            });
        }
        msgBox.scrollTop = msgBox.scrollHeight;
    }
}

function renderSidebar() {
    const listEl = document.getElementById('chat-list-box');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    Object.keys(allConversations).sort((a,b) => b.split('_') - a.split('_')).forEach(id => {
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.dataset.id = id;
        item.innerText = allConversations[id].title;
        item.onclick = () => window.switchChat(id);
        if (id === currentChatId) item.classList.add('active');
        listEl.appendChild(item);
    });
}

async function sendMessage() {
    const inputEl = document.getElementById('user-input');
    if (!inputEl) return;
    
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
        const aiReply = output.generated_text[output.generated_text.length - 1].content;
        if (aiMessageEl) aiMessageEl.innerText = aiReply;
        allConversations[currentChatId].history.push({ role: 'assistant', content: aiReply });
        saveData();
    } catch (error) {
        if (aiMessageEl) aiMessageEl.innerText = "Runtime Error: " + error.message;
    }
    
    const msgBox = document.getElementById('messages-box');
    if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
}

function appendMessage(text, className) {
    const msgBox = document.getElementById('messages-box');
    if (!msgBox) return null;
    
    const div = document.createElement('div');
    const id = 'msg-' + Date.now() + Math.random().toString(36).substr(2, 5);
    div.id = id;
    div.className = `msg ${className}`;
    div.innerText = text;
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
    return id;
}

// Bind methods cleanly to public window scopes
window.createNewChat = createNewChat;
window.switchChat = switchChat;
window.sendMessage = sendMessage;

// Execute system initialization
initAI();

