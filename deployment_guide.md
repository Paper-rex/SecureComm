# SecureComm — Free Deployment Guide

## Architecture Overview

```mermaid
graph LR
  A["Frontend<br/>(Vercel)"] -->|REST API + WebSocket| B["Backend<br/>(Render)"]
  B --> C["MongoDB Atlas<br/>(Free M0)"]
  B --> D["Cloudinary<br/>(Free tier)"]
  B --> E["SMTP<br/>(Gmail)"]
  A --> F["Clerk Auth<br/>(Free tier)"]
```

| Component | Platform | Free Tier | Performance |
|-----------|----------|-----------|-------------|
| **Frontend** (Next.js) | **Vercel** | 100GB bandwidth/mo, edge CDN, serverless | ⚡ Excellent — global edge CDN, zero cold starts |
| **Backend** (NestJS + WebSocket) | **Render** | 750 hrs/mo, WebSocket support | ✅ Good — auto-deploys, native WS support |
| **Database** (MongoDB) | **Atlas** | 512MB M0 cluster | ✅ Already set up |
| **File Storage** | **Cloudinary** | 25GB storage, 25GB bandwidth | ✅ Already set up |
| **Auth** | **Clerk** | 10K MAU free | ✅ Already set up |
| **Email** | **Gmail SMTP** | 500 emails/day | ✅ Already set up |

> [!WARNING]
> **Render free tier** spins down after 15 minutes of inactivity, causing a ~30-50s cold start on the next request. For a chat app this matters. Two ways to mitigate:
> 1. **Cron-job ping** (recommended): Use [cron-job.org](https://cron-job.org) (free) to ping your backend every 14 minutes, keeping it warm 24/7.
> 2. **Upgrade later**: Render's Starter plan ($7/mo) keeps services always-on if you need guaranteed uptime.

---

## Step 1: Push to GitHub

Your project already has a `.git` directory. Push both `frontend/` and `backend/` to a **single GitHub repo**:

```bash
cd N:\Projects\Secure\SecureComm
git add .
git commit -m "Prepare for deployment"
git remote add origin https://github.com/YOUR_USERNAME/SecureComm.git
git push -u origin main
```

> [!IMPORTANT]
> Make sure `.env` and `.env.local` are in your `.gitignore` — **never push secrets to GitHub**. The secrets will be configured as environment variables on the hosting platforms.

---

## Step 2: Deploy Backend on Render

### 2.1 Create Render Account
1. Go to [render.com](https://render.com) and sign up with GitHub

### 2.2 Create a New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your **SecureComm** GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `securecomm-api` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start:prod` |
| **Instance Type** | **Free** |

### 2.3 Set Environment Variables
Go to **Environment** tab and add these:

```
PORT=3001
NODE_ENV=production

MONGODB_URI=mongodb+srv://SecureComm:LenovoDevangHp@cluster0.w0tb9pk.mongodb.net/securecomm?retryWrites=true&w=majority&appName=Cluster0

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2hlZXJmdWwtcGVnYXN1cy05LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_PjIpxqlGJGx8fJgWnBJla9QAQk8oXlwEXKDMWBwLL5

CLOUDINARY_CLOUD_NAME=dwazq5ewm
CLOUDINARY_API_KEY=771597322686513
CLOUDINARY_API_SECRET=ZBEfakegZhvb8Vc_gqS-uQjwKgc

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=securecomm10@gmail.com
SMTP_PASS=hbde tuhr emvi rzqt

FRONTEND_URL=https://YOUR-APP.vercel.app

THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

> [!IMPORTANT]
> You'll get your Render URL after deployment (e.g., `https://securecomm-api.onrender.com`). Note it down — you'll need it for the frontend. Also update `FRONTEND_URL` after deploying the frontend on Vercel.

### 2.4 Deploy
Click **"Create Web Service"**. Render will build and deploy automatically.

---

## Step 3: Deploy Frontend on Vercel

### 3.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com) and sign up with GitHub

### 3.2 Import Project
1. Click **"Add New..."** → **"Project"**
2. Import your **SecureComm** GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Framework** | Next.js (auto-detected) |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` (default) |

### 3.3 Set Environment Variables
Add these in the Vercel project settings → **Environment Variables**:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2hlZXJmdWwtcGVnYXN1cy05LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_PjIpxqlGJGx8fJgWnBJla9QAQk8oXlwEXKDMWBwLL5

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

NEXT_PUBLIC_API_URL=https://securecomm-api.onrender.com/api
NEXT_PUBLIC_WS_URL=https://securecomm-api.onrender.com
```

> [!IMPORTANT]
> Replace `securecomm-api.onrender.com` with your actual Render URL from Step 2.

### 3.4 Deploy
Click **"Deploy"**. Vercel will build and deploy. You'll get a URL like `https://securecomm-xyz.vercel.app`.

---

## Step 4: Update Cross-References

After both are deployed, update these:

### 4.1 Render — Update `FRONTEND_URL`
Go to Render dashboard → your service → **Environment** → update:
```
FRONTEND_URL=https://securecomm-xyz.vercel.app
```
This ensures CORS allows requests from your Vercel domain.

### 4.2 Clerk — Add Production URLs
Go to [Clerk Dashboard](https://dashboard.clerk.com) → your app → **Paths**:
- Add your Vercel URL to the allowed origins

---

## Step 5: Keep Backend Warm (Prevent Cold Starts)

1. Go to [cron-job.org](https://cron-job.org) (free account)
2. Create a new cron job:

| Setting | Value |
|---------|-------|
| **URL** | `https://securecomm-api.onrender.com/api/users/me` |
| **Schedule** | Every 14 minutes |
| **Method** | GET |

This pings the backend every 14 minutes, preventing Render from spinning it down. The endpoint will return 401 (no auth) but that's fine — it keeps the process alive.

---

## Step 6: MongoDB Atlas — Whitelist Render IPs

Since Render free tier uses shared IPs, you need to allow connections from anywhere:

1. Go to [MongoDB Atlas](https://cloud.mongodb.com) → **Network Access**
2. Click **"Add IP Address"**
3. Select **"Allow Access from Anywhere"** (`0.0.0.0/0`)
4. Click **Confirm**

> [!NOTE]
> Your connection string already uses username/password auth, so this is safe. The `0.0.0.0/0` allowlist only means the DB accepts connections from any IP — authentication is still required.

---

## Deployment Checklist

- [ ] Code pushed to GitHub (secrets NOT committed)
- [ ] Backend deployed on Render with all env vars
- [ ] Frontend deployed on Vercel with all env vars
- [ ] `FRONTEND_URL` on Render updated with Vercel domain
- [ ] `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` on Vercel point to Render URL
- [ ] MongoDB Atlas network access allows `0.0.0.0/0`
- [ ] Clerk dashboard has Vercel URL in allowed origins
- [ ] Cron job set up to ping backend every 14 minutes
- [ ] Test: sign up, send message, file upload, real-time updates all work

---

## Cost Summary

| Service | Monthly Cost |
|---------|-------------|
| Vercel (frontend) | **$0** |
| Render (backend) | **$0** |
| MongoDB Atlas M0 | **$0** |
| Cloudinary | **$0** |
| Clerk (< 10K users) | **$0** |
| Gmail SMTP | **$0** |
| Cron-job.org | **$0** |
| **Total** | **$0/month** |
