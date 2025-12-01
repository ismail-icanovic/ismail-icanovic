#!/usr/bin/env bash

# Local Chat Server Startup Script
# Works on macOS, Linux, and Termux

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           Local Hotspot Chat - Termux Setup               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo ""
    echo "Installing Node.js..."
    pkg update && pkg install nodejs -y

    if [ $? -eq 0 ]; then
        echo "✅ Node.js installed successfully!"
    else
        echo "❌ Failed to install Node.js. Please run manually:"
        echo "   pkg install nodejs"
        exit 1
    fi
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install

    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies!"
        exit 1
    fi
    echo "✅ Dependencies installed!"
fi

echo ""
echo "📱 Hotspot Setup Reminder:"
echo "   1. Enable mobile hotspot on this device"
echo "   2. Connect other devices to your hotspot"
echo ""
echo "🌐 Your IP address(es):"
ip addr show | grep "inet " | grep -v "127.0.0.1" | awk '{print "   " $2}' | sed 's/\/.*//'
echo ""
echo "📍 Other devices should connect to:"
echo "   http://[YOUR_IP_ABOVE]:8080"
echo ""
echo "Starting server..."
echo "═══════════════════════════════════════════════════════════"
echo ""

# Start the server
node server.js

