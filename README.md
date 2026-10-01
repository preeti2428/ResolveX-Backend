# ResolveX — Backend API

RESTful API backend for the **ResolveX Grievance Redressal Portal** (AIML & AI Department).

## Tech Stack
- **Node.js** & **Express.js**
- **MongoDB** & **Mongoose**
- **JWT** (JSON Web Tokens) & **bcryptjs**
- **Google OAuth2**

## Getting Started

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Configure your environment variables in `.env`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/resolvex
   JWT_SECRET=your_jwt_secret_key
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   Or production:
   ```bash
   npm start
   ```

## API Endpoints
- `GET /api/health` — Service health & database status
- `POST /api/auth/login` — Email & password login
- `POST /api/auth/google` — Google OAuth verification
- `GET /api/auth/me` — Current authenticated session
- `GET /api/categories` — Role-allowed categories
- `GET /api/grievances` — User grievances
- `GET /api/grievances/all` — Admin: All grievances with cohort filters
- `POST /api/grievances` — Submit a grievance
- `PATCH /api/grievances/:id/status` — Admin: Update ticket status
- `POST /api/grievances/:id/comments` — Thread discussion comments
- `GET /api/analytics` — Cohort breakdown & resolution statistics
- `GET /api/announcements` — Department circulars & notices
- `GET /api/users` — Admin: User governance & role management
