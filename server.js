#!/usr/bin/env node

/**
 * Simple WebSocket Chat Server for Termux
 * No external services - runs completely locally
 * Messages stored in a JSON file with automatic cleanup
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('ws');

const PORT = 8080;
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const MAX_MESSAGES = 100; // Keep only last 100 messages
const MESSAGE_EXPIRY_HOURS = 24; // Delete messages older than 24 hours

// Load existing messages or create empty array
let messages = [];
try {
    if (fs.existsSync(MESSAGES_FILE)) {
        const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
        messages = JSON.parse(data);
        console.log(`Loaded ${messages.length} existing messages`);
    }
} catch (error) {
    console.error('Error loading messages:', error);
    messages = [];
}

// Clean old messages
function cleanOldMessages() {
    const now = Date.now();
    const expiryTime = MESSAGE_EXPIRY_HOURS * 60 * 60 * 1000;
    const originalLength = messages.length;

    messages = messages.filter(msg => {
        return (now - msg.timestamp) < expiryTime;
    });

    // Keep only last MAX_MESSAGES
    if (messages.length > MAX_MESSAGES) {
        messages = messages.slice(-MAX_MESSAGES);
    }

    if (messages.length !== originalLength) {
        console.log(`Cleaned ${originalLength - messages.length} old messages`);
        saveMessages();
    }
}

// Save messages to file
function saveMessages() {
    try {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    } catch (error) {
        console.error('Error saving messages:', error);
    }
}

// Clean old messages on startup
cleanOldMessages();

// Create HTTP server to serve the HTML client
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'chat-client.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading chat client');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Create WebSocket server
const wss = new Server({ server });

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
    console.log('New client connected. Total clients:', clients.size + 1);
    clients.add(ws);

    // Send existing messages to new client
    ws.send(JSON.stringify({
        type: 'history',
        messages: messages
    }));

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === 'chat') {
                // Add timestamp and save
                const newMessage = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    userId: message.userId,
                    text: message.text,
                    timestamp: Date.now()
                };

                messages.push(newMessage);

                // Keep only last MAX_MESSAGES
                if (messages.length > MAX_MESSAGES) {
                    messages = messages.slice(-MAX_MESSAGES);
                }

                saveMessages();

                // Broadcast to all connected clients
                const broadcast = JSON.stringify({
                    type: 'message',
                    message: newMessage
                });

                clients.forEach(client => {
                    if (client.readyState === 1) { // OPEN
                        client.send(broadcast);
                    }
                });

                console.log(`Message from ${message.userId.substring(0, 8)}: ${message.text.substring(0, 50)}`);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected. Total clients:', clients.size);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Clean old messages every hour
setInterval(cleanOldMessages, 60 * 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           Local Chat Server Running                        ║
╠════════════════════════════════════════════════════════════╣
║  Server listening on: http://0.0.0.0:${PORT}                ║
║                                                            ║
║  To connect from another device:                          ║
║  1. Make sure hotspot is enabled on this device           ║
║  2. Connect the other device to this hotspot              ║
║  3. Find this device's IP address:                        ║
║     Run: ip addr show | grep "inet "                      ║
║  4. Open browser on other device:                         ║
║     http://[YOUR_IP]:${PORT}                               ║
║                                                            ║
║  Messages stored in: ${path.basename(MESSAGES_FILE)}                    ║
║  Max messages: ${MAX_MESSAGES} | Expires: ${MESSAGE_EXPIRY_HOURS}h                      ║
╚════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    saveMessages();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

