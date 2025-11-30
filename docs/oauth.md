# Google OAuth Setup

This project uses Google OAuth to protect all routes. Only the email configured in `ALLOWED_EMAIL` can access the application.

## 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application** as the application type
6. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`
7. Click **Create** and copy the **Client ID** and **Client Secret**

## 2. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Google OAuth credentials (from step 1)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here

# NextAuth secret - generate with: openssl rand -base64 32
AUTH_SECRET=your_generated_secret_here

# Email allowed to access the app
ALLOWED_EMAIL=your_email@gmail.com
```

## 3. Generate AUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

## How It Works

- All routes are protected by middleware (`middleware.ts`)
- Unauthenticated users are redirected to `/auth/signin`
- Only the email matching `ALLOWED_EMAIL` can sign in
- Sessions are stored in JWT cookies (no database required)
- Unauthorized emails see an "Access Denied" page

## NextAuth Configuration

The authentication is implemented using NextAuth.js v5 with:

- **Provider**: Google OAuth
- **Session Strategy**: JWT (no database needed)
- **Authorization Callback**: Email whitelist check
- **Middleware**: Route protection for all pages

See `auth.ts` for the complete configuration.

## Production Deployment

For Vercel deployment, add these environment variables in the Vercel dashboard:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `ALLOWED_EMAIL`

Make sure to update the Google OAuth redirect URI to match your production domain.

## Multiple Users (Future Enhancement)

Currently, only one email is supported. To support multiple users:

- Use comma-separated list: `ALLOWED_EMAIL=user1@example.com,user2@example.com`
- Use domain wildcards: `ALLOWED_EMAIL=*@company.com`
- Implement role-based access control

This would require modifying the authorization callback in `auth.ts`.

## Troubleshooting

**"Access Denied" page:**
- Verify `ALLOWED_EMAIL` matches your Google account email exactly
- Check that OAuth credentials are correct
- Ensure redirect URI in Google Console matches your app URL

**Session expires quickly:**
- Check `AUTH_SECRET` is set correctly
- Verify browser allows cookies
- Check for clock skew between server and client

**OAuth error on callback:**
- Verify redirect URI is added to Google Console
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Ensure `AUTH_SECRET` is generated and set
