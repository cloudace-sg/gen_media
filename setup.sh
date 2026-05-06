#!/bin/bash

# AI Image Canvas Setup Script
echo "🚀 Setting up AI Image Canvas..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm install
cd ..

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install
cd ..

# Create environment file for server
echo "⚙️  Setting up environment configuration..."
if [ ! -f "server/.env" ]; then
    cp server/env.example server/.env
    echo "📝 Created server/.env file. Please add your API keys."
else
    echo "📝 server/.env already exists."
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your API keys to server/.env:"
echo "   - GOOGLE_SEARCH_API_KEY"
echo "   - GOOGLE_SEARCH_ENGINE_ID"
echo "   - GOOGLE_GEMINI_API_KEY"
echo ""
echo "2. Start the development servers:"
echo "   npm run dev"
echo ""
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "📚 For more information, see README.md"
