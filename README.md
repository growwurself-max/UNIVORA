# Univora - Education ERP System

Production-ready backend API with React + Vite frontend, powered by Supabase Auth.

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- Supabase project (configured in `.env`)

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
The `.env` file is already configured with Supabase credentials. For production, update:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (backend only)

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
Frontend runs on http://localhost:5173

## 🔐 Demo Login (Development Only)

For local development, a demo user is available:

**Demo Credentials:**
- **Email:** `demo@univora.dev`
- **Password:** `demo123`

**Using Demo Login:**
1. Navigate to http://localhost:5173/login
2. Click the green "🎮 Demo Login (Development Only)" button
3. The demo user will be automatically created (if needed) and logged in

**Or Manual Login:**
- Enter the demo credentials manually in the login form

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
In development mode, email confirmation is automatically skipped. In production, users must confirm their email before logging in.

### Demo User
The demo user is created via Supabase Admin API with:
- Auto-confirmed email
- Metadata flag `is_demo: true`
- Role: Standard user (can be extended for admin features)

### Production Deployment
Before deploying to production:
1. Remove or disable demo login endpoint
2. Enable email confirmation
3. Update CORS origins
4. Use environment-specific config
5. Ensure service role key is never exposed

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
