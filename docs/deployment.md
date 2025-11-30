# Deployment Guide

This guide covers deploying the iTunes-to-Spotify app on Vercel with automated CI/CD via GitHub Actions.

## Prerequisites

1. **GitHub Repository**: Code pushed to GitHub
2. **Turso Database**: Production database set up
3. **Spotify API Credentials**: From [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
4. **Vercel Account**: Free tier is sufficient

## Vercel Setup

### Create Vercel Account

1. Go to https://vercel.com/signup
2. Click "Continue with GitHub"
3. Authorize Vercel to access your GitHub account

### Import Project

1. From Vercel dashboard, click **"Add New Project"**
2. Click **"Import Git Repository"**
3. Select your repository
4. Click **"Import"**

### Configure Build Settings

Vercel auto-detects Next.js. Verify:

- **Framework Preset**: Next.js
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### Add Environment Variables

Before deploying, add these in Vercel dashboard under **Environment Variables**:

#### Required for All Environments

| Variable | Value | Environments |
|----------|-------|--------------|
| `SPOTIFY_CLIENT_ID` | Your Spotify client ID | Production, Preview, Development |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify secret | Production, Preview, Development |

#### Production Only

| Variable | Value | Environments |
|----------|-------|--------------|
| `TURSO_DATABASE_URL` | Production database URL | Production |
| `TURSO_AUTH_TOKEN` | Production auth token | Production |

#### Optional (for OAuth)

| Variable | Value | Environments |
|----------|-------|--------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Production, Preview, Development |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | Production, Preview, Development |
| `AUTH_SECRET` | Generate with `openssl rand -base64 32` | Production, Preview, Development |
| `ALLOWED_EMAIL` | Your email address | Production, Preview, Development |

**Note**: Preview deployments get database credentials dynamically from GitHub Actions (not stored in Vercel).

### Disable Automatic Deployments

The project uses `vercel.json` with `"ignoreCommand": "exit 0"` to prevent automatic deployments. GitHub Actions handles all deployments after running migrations.

To verify in Vercel dashboard:

1. Go to **Settings** → **Git**
2. Find **"Ignored Build Step"** section
3. Should show: `exit 0`

This ensures database migrations run before code deployment.

## GitHub Actions Setup

### Required GitHub Secrets

Add these secrets to your GitHub repository:

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

#### Vercel Secrets

| Secret Name | Where to Get It |
|-------------|----------------|
| `VERCEL_TOKEN` | Vercel Dashboard → Settings → [Tokens](https://vercel.com/account/tokens) → Create Token |
| `VERCEL_ORG_ID` | Run `vercel project ls` or check `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Run `vercel project ls` or check `.vercel/project.json` |

#### Turso Secrets (for Database Branching)

| Secret Name | Where to Get It |
|-------------|----------------|
| `TURSO_DATABASE_URL` | Production database URL |
| `TURSO_AUTH_TOKEN` | Production database token |
| `TURSO_API_TOKEN` | Turso Dashboard → Settings → API Tokens |
| `TURSO_ORG_NAME` | Your Turso organization name |
| `TURSO_PRIMARY_DB_NAME` | Production database name |

### Getting Vercel Credentials

**Vercel Token:**
1. Visit https://vercel.com/account/tokens
2. Click **"Create Token"**
3. Name: "GitHub Actions"
4. Scope: **Full Account**
5. Copy and save as `VERCEL_TOKEN`

**Org ID and Project ID:**
```bash
# Option 1: Via CLI
vercel project ls

# Option 2: Deploy once and check
vercel
cat .vercel/project.json
```

The `project.json` contains:
```json
{
  "orgId": "team_xxxxxxxxxxxxx",
  "projectId": "prj_xxxxxxxxxxxxx"
}
```

### Getting Turso Credentials

**API Token:**
1. Visit https://turso.tech/app
2. Navigate to **Settings** → **API Tokens**
3. Click **Create Token**
4. Name: "GitHub Actions"
5. Copy and save as `TURSO_API_TOKEN`

**Organization Name:**
- Check the URL or top-left menu in Turso dashboard
- Or run: `turso org show`

## CI/CD Pipeline

### On Every Push/PR

GitHub Actions automatically:

1. ✅ Install dependencies
2. ✅ Run linter
3. ✅ Run tests
4. ✅ Build application

### On Push to Main (Production)

5. ✅ Run database migrations on production Turso database
6. ✅ Deploy to Vercel (only if migrations succeed)

### On Pull Requests (Preview)

7. ✅ Create or update Turso branch database (`itunes-spotify-pr-<number>`)
8. ✅ Seed branch database from production
9. ✅ Run migrations on branch database
10. ✅ Generate temporary credentials (7-day expiration)
11. ✅ Deploy preview to Vercel with branch database
12. ✅ Comment on PR with preview URL
13. ✅ Auto-cleanup branch database when PR closes

### Database Branching for PRs

**How it works:**

Each PR gets an isolated database branch via Turso Platform API:

- **Branch database**: `itunes-spotify-pr-42` (example)
- **Seeded from**: Production database (schema + data copy)
- **Migrations**: Run automatically on branch database
- **Credentials**: Generated dynamically via API (7-day tokens)
- **Cleanup**: Automatic deletion when PR closes

**Benefits:**

- ✅ Test schema changes safely with production data
- ✅ Isolated environment per PR
- ✅ No manual database management
- ✅ No credential management in Vercel

**No additional setup required!** Database branching works automatically once GitHub secrets are configured.

## Deployment Workflow

### Production Deployment

```bash
# Push to main branch
git push origin main

# GitHub Actions will:
# 1. Run tests and linter
# 2. Run database migrations
# 3. Deploy to Vercel
# 4. Report status
```

Monitor progress in **GitHub** → **Actions** tab

### Preview Deployment

```bash
# Open a pull request
git checkout -b feature-branch
git push origin feature-branch

# GitHub Actions will:
# 1. Create branch database
# 2. Run migrations on branch
# 3. Deploy preview with branch database
# 4. Comment on PR with preview URL
```

Test your changes on the preview URL. When you close/merge the PR, the branch database is automatically deleted.

### Local Testing

```bash
# Local development (uses local SQLite)
npm run dev

# Test production build locally
vercel dev

# Test with production database (caution!)
TURSO_DATABASE_URL=<prod-url> TURSO_AUTH_TOKEN=<prod-token> npm run dev
```

## Monitoring and Troubleshooting

### View Deployment Logs

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Click deployment** → View build and runtime logs
- **GitHub Actions**: Repository → Actions tab

### Common Issues

**Build fails in Vercel:**
- Check build logs in Vercel dashboard
- Verify all environment variables are set
- Ensure dependencies are in `package.json`

**Database connection errors:**
- Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- Check database is accessible: `turso db show <db-name>`
- Ensure migrations have run

**Spotify API not working:**
- Verify `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
- Check Spotify app settings allow your domain
- May need to add redirect URIs in Spotify Dashboard

**GitHub Actions deployment fails:**
- Check Actions logs: Repository → Actions tab
- Verify all GitHub secrets are set correctly
- Ensure Vercel project is connected to repo
- Check migrations didn't fail

**Preview database issues:**
- Check GitHub Actions logs for Turso API errors
- Verify `TURSO_API_TOKEN` has correct permissions
- Ensure organization name and database name are correct

### Useful Commands

**Vercel CLI:**
```bash
# View deployments
vercel ls

# View environment variables
vercel env ls

# Pull environment variables locally
vercel env pull

# View logs
vercel logs <deployment-url>
```

**Turso CLI:**
```bash
# List all databases (including branch databases)
turso db list

# Show database details
turso db show <database-name>

# Connect to database shell
turso db shell <database-name>

# View schema
turso db shell <database-name> ".schema"
```

**Turso Platform API:**
```bash
# List all databases
curl -H "Authorization: Bearer $TURSO_API_TOKEN" \
  "https://api.turso.tech/v1/organizations/$TURSO_ORG_NAME/databases"

# Delete a database
curl -X DELETE \
  -H "Authorization: Bearer $TURSO_API_TOKEN" \
  "https://api.turso.tech/v1/organizations/$TURSO_ORG_NAME/databases/DB_NAME"
```

## Custom Domain (Optional)

1. Go to Vercel project → **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update OAuth redirect URIs in:
   - Google Cloud Console
   - Spotify Developer Dashboard

## Rolling Back

**Via Vercel Dashboard:**
1. Go to **Deployments**
2. Find previous working deployment
3. Click **...** → **Promote to Production**

**Database rollback:**
- See `CLAUDE.md` for migration rollback procedures
- Contact Turso support for point-in-time recovery

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Configure environment variables
3. ✅ Set up GitHub Secrets
4. ✅ Test the deployment pipeline
5. 🔄 Set up custom domain (optional)

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Turso Documentation](https://docs.turso.tech)
- [Turso Branching](https://docs.turso.tech/features/branching)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
