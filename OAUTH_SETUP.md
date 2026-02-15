# OAuth Setup Guide

This guide explains how to enable Instagram and Google OAuth authentication for Convozo.

## Instagram OAuth Setup

### 1. Create a Facebook App (Instagram uses Facebook Login)

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Choose "Consumer" as the app type
4. Fill in your app details:
   - **App Name**: Convozo
   - **App Contact Email**: your-email@example.com

### 2. Add Instagram Basic Display

1. In your app dashboard, click "Add Product"
2. Find "Instagram Basic Display" and click "Set Up"
3. Click "Create New App" in the Instagram Basic Display settings
4. Fill in the required fields:
   - **Display Name**: Convozo
   - **Valid OAuth Redirect URIs**: 
     - `http://localhost:4200/auth/callback` (for local development)
     - `https://your-domain.com/auth/callback` (for production)
   - **Deauthorize Callback URL**: `https://your-domain.com/api/deauth`
   - **Data Deletion Request URL**: `https://your-domain.com/api/data-deletion`

5. Save the changes and copy:
   - **Instagram App ID**
   - **Instagram App Secret**

### 3. Configure Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Instagram** and enable it
4. Enter your credentials:
   - **Client ID**: Your Instagram App ID
   - **Client Secret**: Your Instagram App Secret
5. The callback URL should be: `https://[your-project-ref].supabase.co/auth/v1/callback`
6. Save the configuration

### 4. Update Instagram App Settings

Go back to Facebook Developers and add the Supabase callback URL to your Instagram app's **Valid OAuth Redirect URIs**:
```
https://[your-project-ref].supabase.co/auth/v1/callback
```

## Google OAuth Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Click "CREATE PROJECT" if creating new:
   - **Project Name**: Convozo
   - **Organization**: (optional)

### 2. Enable Google+ API

1. In the sidebar, go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click on it and press "Enable"

### 3. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click "CREATE CREDENTIALS" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - **User Type**: External
   - **App Name**: Convozo
   - **User support email**: your-email@example.com
   - **Developer contact email**: your-email@example.com
   - **Scopes**: Add `userinfo.email` and `userinfo.profile`
   
4. Create OAuth Client ID:
   - **Application type**: Web application
   - **Name**: Convozo Web Client
   - **Authorized redirect URIs**:
     - `http://localhost:4200/auth/callback` (local)
     - `https://your-domain.com/auth/callback` (production)
     - `https://[your-project-ref].supabase.co/auth/v1/callback` (Supabase)

5. Copy your:
   - **Client ID**
   - **Client Secret**

### 4. Configure Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Google** and enable it
4. Enter your credentials:
   - **Client ID**: Your Google OAuth Client ID
   - **Client Secret**: Your Google OAuth Client Secret
5. Save the configuration

## Local Development

For local development with Supabase CLI:

1. Update your `supabase/config.toml`:

```toml
[auth.external.google]
enabled = true
client_id = "your-google-client-id"
secret = "your-google-client-secret"

[auth.external.instagram]
enabled = true
client_id = "your-instagram-app-id"
secret = "your-instagram-app-secret"
```

2. Restart your local Supabase instance:
```bash
supabase stop
supabase start
```

## Testing OAuth Flow

### Instagram
1. Click "Continue with Instagram"
2. You'll be redirected to Instagram
3. Log in and authorize the app
4. You'll be redirected back to `/auth/callback`
5. The app will check if you have a creator profile
6. New users → Onboarding
7. Existing users → Dashboard

### Google
1. Click "Continue with Google"
2. Choose your Google account
3. Grant permissions
4. Redirected to `/auth/callback`
5. Same flow as Instagram

## Important Notes

- **Instagram requires HTTPS** in production (Facebook policy)
- **Google OAuth** works with localhost for development
- Make sure your redirect URIs match exactly (including trailing slashes)
- For production, always use HTTPS
- Test with different accounts to ensure proper flow

## Troubleshooting

### Instagram: "Redirect URI Mismatch"
- Verify the redirect URI in Facebook Developers matches Supabase's callback URL exactly
- Check for trailing slashes
- Ensure you're using HTTPS in production

### Google: "Error 400: redirect_uri_mismatch"
- Add the exact redirect URI to Google Cloud Console
- Include both your app URL and Supabase callback URL

### "OAuth provider not configured"
- Double-check Supabase provider settings
- Ensure client ID and secret are correct
- Restart Supabase if using local development

## Production Deployment

Before deploying:

1. ✅ Update Instagram redirect URIs with production URLs
2. ✅ Update Google redirect URIs with production URLs
3. ✅ Configure environment variables if needed
4. ✅ Enable HTTPS on your domain
5. ✅ Test OAuth flow in production environment
6. ✅ Monitor authentication logs in Supabase dashboard

## Security Best Practices

- Never commit OAuth credentials to version control
- Use environment variables for sensitive data
- Rotate secrets periodically
- Monitor authentication logs for suspicious activity
- Implement rate limiting on auth endpoints
- Use HTTPS only in production
