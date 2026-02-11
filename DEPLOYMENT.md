# Deployment Guide for Convozo

This guide will walk you through deploying Convozo to production.

## Prerequisites

- Supabase account
- Stripe account with Connect enabled
- Vercel/Netlify account (for frontend hosting)
- Domain name (optional but recommended)

## Step 1: Set Up Supabase

### 1.1 Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Choose your organization
4. Set project name: `convozo-production`
5. Choose a database password (save it securely)
6. Select a region close to your users
7. Click "Create new project"

### 1.2 Run Migrations

1. Navigate to SQL Editor in your Supabase dashboard
2. Run the migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
3. Verify tables were created in the Table Editor

### 1.3 Get API Keys

1. Go to Project Settings > API
2. Copy:
   - Project URL
   - `anon public` key
   - `service_role` key (keep this secret!)

### 1.4 Deploy Edge Functions

Install Supabase CLI:
```bash
npm install -g supabase
```

Login and link project:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Deploy functions:
```bash
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout-session
supabase functions deploy send-reply-email
```

Set secrets for Edge Functions:
```bash
supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key
supabase secrets set STRIPE_WEBHOOK_SECRET=your_webhook_secret
supabase secrets set PLATFORM_FEE_PERCENTAGE=10
supabase secrets set APP_URL=https://your-domain.com
```

## Step 2: Set Up Stripe

### 2.1 Create Stripe Account

1. Go to https://stripe.com
2. Create an account and complete verification
3. Enable Stripe Connect in your dashboard

### 2.2 Get API Keys

1. Go to Developers > API keys
2. Copy:
   - Publishable key
   - Secret key
3. **Important**: Use test keys for testing, live keys for production

### 2.3 Configure Connect

1. Go to Connect > Settings
2. Set up your platform profile
3. Configure branding
4. Set redirect URLs:
   - Success: `https://your-domain.com/creator/dashboard`
   - Failure: `https://your-domain.com/creator/onboarding`

### 2.4 Set Up Webhooks

1. Go to Developers > Webhooks
2. Add endpoint: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
3. Select events to listen for:
   - `checkout.session.completed`
   - `account.updated` (for Connect accounts)
4. Copy the webhook signing secret

## Step 3: Configure Frontend

### 3.1 Update Environment Files

Create production environment file:

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  supabase: {
    url: 'https://YOUR_PROJECT_REF.supabase.co',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
  },
  stripe: {
    publishableKey: 'pk_live_YOUR_STRIPE_KEY',
  },
  platformFeePercentage: 10,
};
```

### 3.2 Build for Production

```bash
npm run build
```

The build output will be in `dist/convozo-app/`

## Step 4: Deploy Frontend

### Option A: Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow prompts to deploy
4. Set environment variables in Vercel dashboard
5. Connect your domain

### Option B: Netlify

1. Install Netlify CLI: `npm i -g netlify-cli`
2. Run: `netlify deploy --prod`
3. Set environment variables in Netlify dashboard
4. Connect your domain

### Option C: Manual Hosting

1. Upload `dist/convozo-app/` to your web server
2. Configure server to serve Angular app:
   - Redirect all routes to `index.html`
   - Enable gzip compression
   - Set proper cache headers

## Step 5: Post-Deployment

### 5.1 Update App URLs

1. Update `APP_URL` secret in Supabase Edge Functions
2. Update Stripe redirect URLs with your domain
3. Update CORS settings if needed

### 5.2 Test the Flow

1. Create a test creator account
2. Complete onboarding
3. Set up pricing
4. Visit your public page
5. Submit a test payment (use Stripe test card)
6. Verify webhook receives payment
7. Check message in creator dashboard
8. Send a reply
9. Verify email notification

### 5.3 Enable Production Mode

1. Switch Stripe from test to live mode
2. Update environment variables with live keys
3. Redeploy Edge Functions with updated secrets

## Step 6: Monitoring

### 6.1 Set Up Monitoring

1. Enable Supabase Realtime for live updates
2. Set up error tracking (e.g., Sentry)
3. Monitor Stripe dashboard for payments
4. Set up uptime monitoring

### 6.2 Database Backups

1. Enable automated backups in Supabase
2. Test restore process
3. Set up point-in-time recovery if available

## Security Checklist

- [ ] All environment variables are set correctly
- [ ] Service role key is kept secret
- [ ] Stripe webhook secret is configured
- [ ] RLS policies are enabled on all tables
- [ ] HTTPS is enforced
- [ ] CORS is properly configured
- [ ] Rate limiting is implemented (future enhancement)
- [ ] Input validation is in place

## Troubleshooting

### Payments Not Processing

- Verify Stripe webhook is receiving events
- Check Edge Function logs in Supabase
- Ensure webhook secret matches
- Verify Stripe keys are correct

### Auth Issues

- Check Supabase URL and anon key
- Verify email templates are configured
- Check redirect URLs in Supabase

### Build Errors

- Clear cache: `rm -rf .angular`
- Reinstall dependencies: `npm ci`
- Check Node.js version (18+)

## Performance Optimization

1. Enable CDN for static assets
2. Implement lazy loading (already done)
3. Optimize images
4. Enable gzip/brotli compression
5. Set up caching headers

## Cost Estimation

- **Supabase**: Free tier covers most MVPs, ~$25/month for pro
- **Stripe**: 2.9% + 30¢ per transaction + Connect fees
- **Hosting**: $0-20/month depending on traffic
- **Domain**: ~$10-15/year

## Support

For issues:
1. Check Supabase logs
2. Check Stripe dashboard
3. Review browser console
4. Check network requests
5. Open a GitHub issue

## Next Steps

After deployment:
1. Set up analytics
2. Implement email service (SendGrid, Resend)
3. Add complete Stripe Connect onboarding
4. Implement rate limiting
5. Add admin dashboard
6. Set up monitoring and alerts
