# Univora - Education ERP System

Production-ready backend API with React + Vite frontend, powered by Supabase Auth.

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20.0.0
- Supabase project

### Installation

1. **Install Backend Dependencies**
```bash
npm install
```

2. **Install Frontend Dependencies**
```bash
cd frontend
npm install
cd ..
```

3. **Configure Environment**
Copy `.env.example` to `.env` and configure:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (backend only)
- `CORS_ORIGIN` - Comma-separated trusted frontend origins (required in production)
- `GEMINI_API_KEY` - Required only when enabling the AI assistant

### Running the Application

**Start Backend:**
```bash
npm run dev
```
Backend runs on http://localhost:5000

**Start Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on http://localhost:5174

## 🔐 Demo Login (Development Only)

Demo access is an optional, explicitly triggered development feature. Configure
`DEMO_EMAIL` and `DEMO_PASSWORD` in the backend `.env`; do not commit these
values or set them in production. Set `VITE_ENABLE_DEMO_LOGIN=true` in
`frontend/.env` to show its separate login button. Demo provisioning happens
only after the button is clicked; ordinary sign-in is unaffected.

**Important:**
- Demo login is only available in development mode
- Demo user is created using Supabase Admin API
- This feature is disabled in production

## 📁 Project Structure

```
univora/
├── src/                    # Backend source
│   ├── config/            # Configuration (Supabase, env)
│   ├── controllers/       # Request handlers
│   ├── middleware/        # Express middleware
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── utils/            # Utilities
├── frontend/             # Frontend (React + Vite)
│   ├── src/
│   │   ├── context/     # React context (Auth)
│   │   ├── pages/       # Page components
│   │   ├── services/    # API client
│   │   └── components/  # Reusable components
├── .env                  # Environment variables
└── package.json          # Backend dependencies
```

## 🔌 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user (protected)
- `POST /api/v1/auth/demo/setup` - Setup demo user (dev only)

### Health
- `GET /api/v1/health` - Health check

## 🎨 Frontend Features

- **Authentication:** Login, Registration, Logout
- **Protected Routes:** Dashboard requires authentication
- **Demo Login:** Quick access for development
- **Responsive Design:** Works on all screen sizes
- **Professional UI:** Clean light theme with Tailwind CSS

## 🔒 Security

- Supabase Auth for user authentication
- JWT tokens stored in localStorage
- Service role key only in backend (never exposed to frontend)
- CORS configured for allowed origins
- Email confirmation skipped in development (enabled in production)
- Demo user creation disabled in production

## 🛠️ Development

### Email Confirmation
Email confirmation follows the Supabase Auth settings for the project. Configure
local/test confirmation behavior in the local Supabase project, and require
confirmed addresses in production.

### Demo User
The demo user is created via Supabase Admin API with:
- Auto-confirmed email
- Metadata flag `is_demo: true`
- Role: Standard user (can be extended for admin features)

### Production Deployment
Before deploying to production:
1. Set `CORS_ORIGIN` to explicit trusted frontend origins.
2. Enable email confirmation in Supabase Auth.
3. Set `VITE_API_BASE_URL` to the deployed backend API.
4. Configure Supabase Auth redirect URLs for the deployed frontend.
5. Keep the service-role and Gemini keys on the backend only.
6. Apply the reviewed SQL migrations in `supabase/migrations` in filename order
   to staging, then production. Do not use `supabase db reset` on an existing
   project. Confirm the deployed role names and institution assignments before
   enabling user access.

## 📝 Scripts

**Backend:**
- `npm start` - Start production server
- `npm run dev` - Start development server with watch mode

**Frontend:**
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 🤝 Contributing

This is a demonstration project. Features can be extended based on requirements.

## 📄 License

MIT
