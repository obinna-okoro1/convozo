# Convozo - Creator Monetization Platform

A modern web application that enables Instagram influencers to monetize inbound messages through a paid message submission system, built with Angular and Supabase.

## 🚀 Overview

Convozo allows creators to:
- Set up a custom message page with personalized pricing
- Receive paid priority messages from fans and businesses
- Manage messages in a clean, intuitive dashboard
- Reply to messages with automatic email notifications
- Get paid securely via Stripe Connect

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Angular 21+ (Standalone Components, Signals)
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Edge Functions)
- **Payments**: Stripe Checkout + Stripe Connect Express
- **Styling**: Tailwind CSS
- **Email**: Supabase Edge Functions (placeholder implementation)

### Project Structure

```
convozo/
├── src/
│   ├── app/
│   │   ├── auth/              # Authentication components
│   │   │   ├── login/         # Magic link login
│   │   │   └── callback/      # Auth callback handler
│   │   ├── creator/           # Creator-facing features
│   │   │   ├── onboarding/    # Creator profile setup
│   │   │   └── dashboard/     # Message inbox & management
│   │   ├── public/            # Public-facing pages
│   │   │   ├── landing/       # Marketing homepage
│   │   │   ├── message-page/  # Paid message submission
│   │   │   └── success/       # Payment confirmation
│   │   └── shared/            # Shared services
│   │       └── supabase.service.ts
│   └── environments/          # Environment configs
├── supabase/
│   ├── migrations/            # Database schema & RLS policies
│   └── functions/             # Edge Functions
│       ├── stripe-webhook/    # Payment webhook handler
│       ├── create-checkout-session/
│       └── send-reply-email/
└── tailwind.config.js
```

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Stripe account

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/obinna-okoro1/convozo.git
   cd convozo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project at https://supabase.com
   - Run the migrations in `supabase/migrations/` in order:
     ```sql
     -- Run 001_initial_schema.sql
     -- Run 002_rls_policies.sql
     ```
   - Deploy Edge Functions:
     ```bash
     supabase functions deploy stripe-webhook
     supabase functions deploy create-checkout-session
     supabase functions deploy send-reply-email
     ```

4. **Set up Stripe**
   - Create a Stripe account at https://stripe.com
   - Get your API keys from the dashboard
   - Set up Stripe Connect for platform payments
   - Configure webhook endpoint pointing to your Supabase Edge Function

5. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Fill in your Supabase and Stripe credentials
   - Update `src/environments/environment.ts` and `environment.prod.ts`

6. **Run the development server**
   ```bash
   npm start
   ```
   Navigate to `http://localhost:4200`

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# App Configuration
PLATFORM_FEE_PERCENTAGE=10
APP_URL=http://localhost:4200
```

### Angular Environment Files

Update `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  supabase: {
    url: 'YOUR_SUPABASE_URL',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
  },
  stripe: {
    publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY',
  },
  platformFeePercentage: 10,
};
```

## 🗄️ Database Schema

### Tables

- **creators**: Creator profiles and account info
- **creator_settings**: Pricing and messaging preferences
- **stripe_accounts**: Stripe Connect account linkage
- **messages**: Paid messages from senders
- **payments**: Payment transaction records

### Row Level Security (RLS)

All tables have strict RLS policies:
- Creators can only access their own data
- Public users can view creator profiles and settings (read-only)
- Messages and payments are creator-specific
- Service role required for Edge Function operations

## 🔐 Security Features

- ✅ Magic link authentication (no passwords)
- ✅ Row Level Security on all database tables
- ✅ Stripe webhook signature verification
- ✅ Server-side payment validation
- ✅ Input sanitization and validation
- ✅ CORS configuration for Edge Functions
- ✅ Rate limiting (to be implemented in production)

## 🎨 UI/UX Features

- Minimalist, luxury design inspired by Stripe, Linear, and Notion
- Skeleton loaders for better perceived performance
- Smooth animations and micro-interactions
- Empty states with helpful guidance
- Mobile-responsive layouts
- Success states with clear next steps
- Accessibility considerations

## 🚢 Deployment

### Frontend (Angular)

Deploy to Vercel, Netlify, or any static hosting:

```bash
npm run build
# Deploy the dist/ folder
```

### Backend (Supabase)

1. Set up production Supabase project
2. Run migrations
3. Deploy Edge Functions
4. Configure environment variables
5. Set up Stripe webhook in production

### Environment-specific Configuration

- Update `environment.prod.ts` with production URLs
- Configure production Stripe keys
- Set up production domain in Stripe Connect settings
- Configure production webhook endpoints

## 📊 Features Roadmap

### Implemented ✅
- [x] Creator authentication with magic links
- [x] Creator onboarding flow
- [x] Profile and pricing setup
- [x] Public message submission page
- [x] Stripe Checkout integration
- [x] Stripe Connect Express full onboarding flow
- [x] Creator dashboard with message inbox
- [x] Message reply functionality
- [x] Payment processing with webhooks
- [x] RLS policies for data security
- [x] Rate limiting on message submission

### Future Enhancements 🔮
- [ ] Actual email service integration (SendGrid/Resend)
- [ ] Message filtering and search
- [ ] Analytics dashboard
- [ ] Automated responses
- [ ] Message templates
- [ ] File attachments
- [ ] Admin panel
- [ ] Subscription plans for creators

## ⚠️ Known Limitations

1. **Email Service**: Placeholder implementation; requires actual email provider
2. **Rate Limiting**: Implemented in-memory (use Redis for production)
3. **File Uploads**: No support for image/video messages yet
4. **Instagram Integration**: No direct DM integration (by design - off-platform only)

## 🧪 Testing

### Local Development Testing

1. Create a test creator account
2. Set up test pricing
3. Use Stripe test cards for payments:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`

### Stripe Test Mode

Ensure you're using test mode API keys during development.

## 📝 Sample Data

To seed the database with sample data:

```sql
-- Insert a test creator
INSERT INTO creators (user_id, email, display_name, slug, bio)
VALUES (
  'test-user-id',
  'creator@example.com',
  'Test Creator',
  'testcreator',
  'I''m a test creator for demo purposes'
);

-- Add creator settings
INSERT INTO creator_settings (creator_id, single_price, response_expectation)
VALUES (
  'creator-id-from-above',
  5000, -- $50
  'I typically respond within 24 hours'
);
```

## 🤝 Contributing

This is a production MVP built for demonstration purposes. For contributions or improvements:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary. All rights reserved.

## 🙏 Acknowledgments

- Built with Angular, Supabase, and Stripe
- UI/UX inspired by modern SaaS platforms
- Not affiliated with Instagram or Meta Platforms, Inc.

## 📞 Support

For issues or questions, please open an issue on GitHub.

---

**Note**: This platform operates independently from Instagram. It does not access, modify, or interact with Instagram DMs. Users share their Convozo link via Instagram bio or manual messages.
