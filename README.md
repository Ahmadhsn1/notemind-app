# NoteMind

A full-stack note-taking app with AI-assisted tagging, note Q&A, and title suggestions, built on the MERN stack (MongoDB, Express, React, Node) with Google Gemini for AI features.

## Features

- User authentication (register/login) with JWT
- Create, read, update, and delete notes
- Folders, tags, and search/filtering
- AI-powered note processing (auto-tagging via Gemini)
- "Ask AI" — query across your notes
- AI-suggested note titles
- Responsive UI built with React + Tailwind CSS

## Tech Stack

| Layer    | Technology                                   |
| -------- | --------------------------------------------- |
| Frontend | React 19, Vite, Tailwind CSS 4, React Router  |
| Backend  | Node.js, Express 5, Mongoose                  |
| Database | MongoDB                                       |
| Auth     | JSON Web Tokens (JWT), bcrypt                 |
| AI       | Google Gemini (`@google/genai`)               |

## Prerequisites

- Node.js >= 20 (see `.nvmrc` — run `nvm use` if you use nvm)
- A MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A [Gemini API key](https://ai.google.dev/) for AI features

## Project Structure

```
notemind-app/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── api/         # Axios API clients
│       ├── components/  # Reusable UI components
│       ├── context/     # React context (auth, etc.)
│       ├── pages/        # Route-level pages (Login, Register, Dashboard)
│       └── utils/        # Helper utilities
└── server/          # Express backend
    ├── config/          # Database connection
    ├── controllers/     # Route handlers
    ├── middleware/       # Auth middleware
    ├── models/           # Mongoose schemas (User, Note)
    ├── routes/            # API route definitions
    ├── scripts/           # One-off maintenance scripts
    └── services/          # AI service (Gemini integration)
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Ahmadhsn1/notemind-app.git
cd notemind-app
```

### 2. Set up the backend

```bash
cd server
npm install
```

Create a `.env` file in `server/` with the following variables:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
```

Start the backend:

```bash
node server.js
```

The API will be available at `http://localhost:5000`.

### 3. Set up the frontend

In a new terminal:

```bash
cd client
npm install
npm run dev
```

The app will be available at `http://localhost:5173` (Vite's default port).

## API Overview

### Auth (`/api/auth`)

| Method | Endpoint    | Description         |
| ------ | ----------- | -------------------- |
| POST   | `/register` | Register a new user  |
| POST   | `/login`    | Log in and get a JWT |

### Notes (`/api/notes`) — all routes require `Authorization: Bearer <token>`

| Method | Endpoint         | Description                          |
| ------ | ---------------- | ------------------------------------- |
| GET    | `/`               | List all notes for the current user   |
| GET    | `/:id`            | Get a single note                     |
| POST   | `/`               | Create a note                         |
| PUT    | `/:id`            | Update a note                         |
| DELETE | `/:id`            | Delete a note                         |
| POST   | `/:id/ai-process` | Run AI processing (auto-tagging) on a note |
| POST   | `/ask`            | Ask a question across your notes      |
| POST   | `/suggest-title`  | Get an AI-suggested title for a note  |

## Scripts

- `server/scripts/merge-ai-tags.js` — backfills AI-generated tags onto existing notes.

## License

ISC
