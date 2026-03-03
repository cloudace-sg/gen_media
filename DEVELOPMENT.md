# Development Guide

## Project Overview

This is a monorepo containing a React frontend and Node.js backend for an AI-driven image manipulation creative canvas.

## Architecture

```
├── client/          # React frontend (Port 3000)
├── server/          # Express.js backend (Port 3001)
└── package.json     # Monorepo configuration
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)

### Quick Setup

1. Run the setup script:
   ```bash
   ./setup.sh
   ```

2. Configure API keys in `server/.env`:
   ```env
   GOOGLE_SEARCH_API_KEY=your_key_here
   GOOGLE_SEARCH_ENGINE_ID=your_engine_id_here
   GOOGLE_GEMINI_API_KEY=your_gemini_key_here
   ```

3. Start development servers:
   ```bash
   npm run dev
   ```

### Manual Setup

If you prefer manual setup:

1. Install dependencies:
   ```bash
   npm run install:all
   ```

2. Copy environment file:
   ```bash
   cp server/env.example server/.env
   ```

3. Start servers:
   ```bash
   npm run dev
   ```

## API Keys Setup

### Google Custom Search API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Custom Search API
3. Create credentials (API Key)
4. Create a Custom Search Engine at [cse.google.com](https://cse.google.com/)
5. Add the API key and Search Engine ID to your `.env` file

### Google Gemini API

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Add the key to your `.env` file
4. The application uses `gemini-2.0-flash-exp` model for both text-to-image and image-to-image operations

## Development Commands

### Root Level
- `npm run dev` - Start both client and server
- `npm run build` - Build both applications
- `npm run install:all` - Install all dependencies

### Client (React)
- `npm run dev:client` - Start React development server
- `npm run build:client` - Build React app
- `npm run test` - Run tests

### Server (Node.js)
- `npm run dev:server` - Start Express server with nodemon
- `npm run build:server` - Build server (no-op for Node.js)

## Project Structure

### Frontend (`client/`)
```
src/
├── components/          # React components
│   ├── Header.js
│   ├── SearchModule.js
│   ├── GenerateModule.js
│   ├── Workspace.js
│   ├── ImageGrid.js
│   ├── ImageThumbnail.js
│   ├── StagingArea.js
│   ├── ImageModal.js
│   └── LoadingSkeleton.js
├── store/               # State management
│   └── useStore.js
├── services/            # API services
│   └── api.js
├── App.js
├── index.js
└── index.css
```

### Backend (`server/`)
```
src/
├── routes/              # API routes
│   ├── search.js
│   ├── generate.js
│   └── remix.js
├── services/            # Service layer
│   └── gemini.js        # Gemini AI service
└── index.js
```

## Key Features

### 1. Multi-Row Workspace
- Dynamic rows for different content types
- Independent row management
- Clear/remove functionality

### 2. Image Search
- Google Custom Search API integration
- Thumbnail display
- Source attribution

### 3. AI Image Generation
- Text-to-image using AI models
- Multiple style options
- Loading states

### 4. Advanced Remix & Compositing
- Image selection with reference variables (@1, @2, etc.)
- Natural language instruction parsing
- Staging area for selected images
- Complex image operations

## State Management

The application uses Zustand for state management with the following key state:

- `rows`: Array of workspace rows
- `selectedImages`: Array of selected images for remix
- `isModalOpen`: Modal visibility state
- `isLoading`: Loading states for different operations

## API Endpoints

### Search
- `GET /api/search?query=...` - Search for images

### Generate
- `GET /api/generate?prompt=...&style=...` - Generate images from text

### Remix
- `POST /api/remix` - Remix selected images with instructions

## Styling

The application uses Tailwind CSS with a custom dark theme:

- Dark background (`#0a0a0a`)
- Surface colors (`#1a1a1a`)
- Accent color (`#3b82f6`)
- Custom animations and transitions

## Troubleshooting

### Common Issues

1. **API Keys Not Working**
   - Verify keys are correctly set in `.env`
   - Check API quotas and billing
   - Ensure APIs are enabled in Google Cloud Console

2. **CORS Issues**
   - Verify `CLIENT_URL` in server `.env`
   - Check that client is running on port 3000

3. **Build Issues**
   - Clear node_modules and reinstall
   - Check Node.js version compatibility

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` in your `.env` file.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational and development purposes.
