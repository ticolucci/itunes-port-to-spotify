# Vercel Deployment Setup Guide

This guide walks you through deploying the iTunes-to-Spotify app on Vercel.

## Prerequisites

1. **GitHub Repository**: Your code should be pushed to GitHub (already done ✓)
2. **Turso Database**: You need a Turso database set up for production
3. **Spotify API Credentials**: You need Spotify API credentials from https://developer.spotify.com/dashboard

## Option 1: Deploy via Vercel Dashboard (Recommended for First Time)

### Step 1: Create Vercel Account

1. Go to https://vercel.com/signup
2. Click "Continue with GitHub"
3. Authorize Vercel to access your GitHub account

### Step 2: Import Your Project

1. From your Vercel dashboard, click **"Add New Project"**
2. Click **"Import Git Repository"**
3. Find and select `ticolucci/itunes-port-to-spotify`
4. Click **"Import"**

### Step 3: Configure Project Settings

Vercel will auto-detect your Next.js app. Verify these settings:

- **Framework Preset**: Next.js
- **Root Directory**: `./` (default)
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)

### Step 4: Add Environment Variables

Before clicking "Deploy", add these environment variables:

**Required Variables:**

| Name | Value | Where to Get It |
|------|-------|----------------|
| `SPOTIFY_CLIENT_ID` | Your Spotify client ID | https://developer.spotify.com/dashboard |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify client secret | https://developer.spotify.com/dashboard |
| `TURSO_DATABASE_URL` | Your Turso database URL | Run: `turso db show <db-name>` |
| `TURSO_AUTH_TOKEN` | Your Turso auth token | Run: `turso db tokens create <db-name>` |

**To add variables in Vercel:**
1. Scroll to "Environment Variables" section
2. Click "Add" for each variable
3. Enter the name and value
4. Select all environments (Production, Preview, Development)
5. Click "Add"

### Step 5: Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (1-3 minutes)
3. Once deployed, you'll get a URL like `https://your-app.vercel.app`

### Step 6: Run Database Migrations

After first deployment, run migrations on your Turso database:

```bash
# Make sure your .env.local has Turso credentials
npm run db:migrate
```

Or manually via Turso CLI:
```bash
turso db shell <db-name> < drizzle/migrations/0000_initial_migration.sql
```

---

## Option 2: Deploy via Vercel CLI

### Install Vercel CLI

```bash
npm install -g vercel
```

### Login to Vercel

```bash
vercel login
```

### Deploy from Terminal

```bash
# First deployment (will prompt for configuration)
vercel

# Production deployment
vercel --prod
```

The CLI will ask you questions:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N** (first time)
- What's your project's name? `itunes-port-to-spotify`
- In which directory is your code located? `./`

### Add Environment Variables via CLI

```bash
# Add each variable for production
vercel env add SPOTIFY_CLIENT_ID production
vercel env add SPOTIFY_CLIENT_SECRET production
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production

# Add for preview/development environments
vercel env add SPOTIFY_CLIENT_ID preview
vercel env add SPOTIFY_CLIENT_SECRET preview
vercel env add TURSO_DATABASE_URL preview
vercel env add TURSO_AUTH_TOKEN preview
```

---

## Post-Deployment

### Verify Deployment

1. Visit your deployed URL
2. Check that the app loads correctly
3. Test the Spotify matching functionality

### Set Up Custom Domain (Optional)

1. Go to your project in Vercel dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

### Automatic Deployments

Once connected, Vercel will automatically:
- Deploy on every push to `main` branch (production)
- Create preview deployments for pull requests
- Run your build and tests automatically

### Monitor Deployments

- **Dashboard**: https://vercel.com/dashboard
- **View logs**: Click on any deployment to see build logs
- **Runtime logs**: Available in the "Functions" tab

---

## Troubleshooting

### Build Fails

- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify environment variables are set correctly

### Database Connection Issues

- Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are correct
- Check Turso database is accessible: `turso db show <db-name>`
- Ensure migrations have been run

### Spotify API Not Working

- Verify `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are correct
- Check Spotify app settings allow your Vercel domain
- May need to add redirect URIs in Spotify Dashboard

---

## Development Workflow

```bash
# Local development (uses local SQLite)
npm run dev

# Test production build locally
vercel dev

# Deploy to preview
git push origin feature-branch  # Creates preview deployment automatically

# Deploy to production
git push origin main  # Deploys to production automatically
```

---

## Useful Commands

```bash
# View project info
vercel ls

# View environment variables
vercel env ls

# Pull environment variables to local .env.local
vercel env pull

# View deployment logs
vercel logs <deployment-url>

# Rollback to previous deployment
# (Via dashboard: Deployments → ... → Promote to Production)
```

---

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Configure environment variables
3. ✅ Run database migrations
4. ✅ Test the deployment
5. 🔄 Set up custom domain (optional)
6. 🔄 Configure preview environments for PRs

For more information, see: https://vercel.com/docs
