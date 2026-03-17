# SecureComm

SecureComm is a modern, end-to-end encrypted messaging platform. It features real-time 1:1 and group chats, secure file sharing, role-based group management, and user presence tracking.

Built with **Next.js 14**, **NestJS**, **Socket.IO**, and **MongoDB**.

## Features

- **End-to-End Encryption**: AES-256-GCM for messages and files, protected by RSA-4096 key pairs.
- **Real-Time Messaging**: Instant delivery via Socket.IO with delivery/read receipts.
- **Secure File Sharing**: Files encrypted client-side (AES-256-GCM) then stored in Cloudinary.
- **Group Chats**: Fully featured role-based access control (Creator, Admin, Member).
- **User Authentication**: Secure onboarding and identity management via Clerk.

---

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

Make sure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)
- A [Clerk](https://clerk.com/) account for authentication keys
- A [Cloudinary](https://cloudinary.com/) account for encrypted file storage (free tier available)

### 1. Clone the Repository

```bash
git clone https://github.com/Paper-rex/SecureComm.git
cd SecureComm
```

### 2. Cloudinary Storage Setup

1. Create a free [Cloudinary](https://cloudinary.com/users/register_free) account.
2. From the Cloudinary **Dashboard**, note your **Cloud Name**, **API Key**, and **API Secret**.
3. These will be added to your `.env` file below.

### 3. Backend Setup

Open a terminal and navigate to the backend folder:
```bash
cd backend
npm install
```

**Environment Variables:**
Create a `.env` file in the `backend/` directory using the template below. **Do not use your real production keys.**

```env
# Server
PORT=3001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/securecomm  # Replace with your Atlas URI if remote

# Clerk
CLERK_SECRET_KEY=sk_test_...                      # From Clerk Dashboard
CLERK_PUBLISHABLE_KEY=pk_test_...                 # From Clerk Dashboard
CLERK_WEBHOOK_SECRET=whsec_...                    # Optional: For Webhooks

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (SMTP for Invites)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:3000

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

Start the backend development server:
```bash
npm run start:dev
```

### 4. Frontend Setup

Open a new terminal and navigate to the frontend folder:
```bash
cd frontend
npm install
```

**Environment Variables:**
Create a `.env.local` file in the `frontend/` directory:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...     # From Clerk Dashboard
CLERK_SECRET_KEY=sk_test_...                      # From Clerk Dashboard

# Clerk Routes
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

Start the frontend development server:
```bash
npm run dev
```

### 5. Running the App

Once both servers are running:
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Sign up or log in using Clerk.
3. Start inviting users and chatting securely!

---

## Folder Structure

- `/frontend` - Next.js 14 App Router, ShadCN UI, TailwindCSS, Socket.io-client
- `/backend` - NestJS API, Socket.io Gateway, Mongoose Models, E2E Key Management
- `/docs` - Architecture blueprints, database schemas, and API design.

## License
MIT
