-- Seed data for local development and testing
-- Run this after setting up your database schema

-- Note: You'll need to replace 'YOUR_USER_ID' with an actual auth.users id
-- You can get this by signing up through the app first

-- Sample Creator 1
INSERT INTO public.creators (user_id, email, display_name, slug, bio, profile_image_url)
VALUES (
  'YOUR_USER_ID_HERE', -- Replace with your actual user ID from auth.users
  'creator@example.com',
  'Sarah Johnson',
  'sarahjohnson',
  'Fashion influencer & lifestyle creator. Share your brand inquiries and fan messages here!',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400'
)
ON CONFLICT (user_id) DO NOTHING;

-- Get the creator ID for Sarah Johnson
-- You'll need to manually get this ID and use it below
-- SELECT id FROM public.creators WHERE email = 'creator@example.com';

-- Sample Creator Settings (Single Price)
INSERT INTO public.creator_settings (creator_id, has_tiered_pricing, single_price, response_expectation, auto_reply_text)
SELECT 
  id,
  false,
  5000, -- $50
  'I typically respond within 24-48 hours during business days.',
  'Thanks for reaching out! To send me a priority message, visit: https://convozo.com/sarahjohnson'
FROM public.creators 
WHERE slug = 'sarahjohnson'
ON CONFLICT (creator_id) DO NOTHING;

-- Sample Creator 2 (Tiered Pricing)
INSERT INTO public.creators (user_id, email, display_name, slug, bio)
VALUES (
  'YOUR_SECOND_USER_ID_HERE', -- Replace with another user ID
  'creator2@example.com',
  'Mike Chen',
  'mikechen',
  'Tech reviewer & gaming enthusiast. Let''s connect!'
)
ON CONFLICT (user_id) DO NOTHING;

-- Sample Creator Settings (Tiered Pricing)
INSERT INTO public.creator_settings (creator_id, has_tiered_pricing, fan_price, business_price, response_expectation)
SELECT 
  id,
  true,
  2500, -- $25 for fans
  10000, -- $100 for business
  'Fan messages: 2-3 days. Business inquiries: 24 hours.'
FROM public.creators 
WHERE slug = 'mikechen'
ON CONFLICT (creator_id) DO NOTHING;

-- Sample Stripe Account (Mock - not real Stripe account)
INSERT INTO public.stripe_accounts (creator_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, onboarding_completed)
SELECT 
  id,
  'acct_test_123456789',
  true,
  true,
  true,
  true
FROM public.creators 
WHERE slug = 'sarahjohnson'
ON CONFLICT (creator_id) DO NOTHING;

-- Sample Messages (for testing inbox)
INSERT INTO public.messages (creator_id, sender_name, sender_email, message_content, amount_paid, message_type, is_handled)
SELECT 
  id,
  'John Doe',
  'john@example.com',
  'Hi Sarah! I love your content and would love to collaborate on an upcoming project. Would you be interested in discussing a partnership?',
  5000,
  'single',
  false
FROM public.creators 
WHERE slug = 'sarahjohnson';

INSERT INTO public.messages (creator_id, sender_name, sender_email, message_content, amount_paid, message_type, is_handled, reply_content, replied_at)
SELECT 
  id,
  'Jane Smith',
  'jane@example.com',
  'Your recent video was amazing! Can you share more about your creative process?',
  5000,
  'single',
  true,
  'Thanks so much for the kind words! I''ll definitely create a behind-the-scenes video soon.',
  NOW() - INTERVAL '2 days'
FROM public.creators 
WHERE slug = 'sarahjohnson';

INSERT INTO public.messages (creator_id, sender_name, sender_email, message_content, amount_paid, message_type, is_handled)
SELECT 
  id,
  'Brand Manager',
  'partnerships@brand.com',
  'We''re interested in a sponsored content opportunity. Could we schedule a call?',
  5000,
  'single',
  false
FROM public.creators 
WHERE slug = 'sarahjohnson';

-- Sample Payments
INSERT INTO public.payments (message_id, creator_id, stripe_checkout_session_id, stripe_payment_intent_id, amount, platform_fee, creator_amount, status, sender_email)
SELECT 
  m.id,
  c.id,
  'cs_test_' || md5(random()::text),
  'pi_test_' || md5(random()::text),
  5000,
  500, -- 10% platform fee
  4500,
  'completed',
  m.sender_email
FROM public.messages m
JOIN public.creators c ON m.creator_id = c.id
WHERE c.slug = 'sarahjohnson';

-- Output instructions
SELECT 'Seed data inserted successfully!' as message;
SELECT 'Remember to:' as note;
SELECT '1. Replace YOUR_USER_ID_HERE with actual auth.users IDs' as step_1;
SELECT '2. Sign up through the app to create auth users first' as step_2;
SELECT '3. Update the environment variables with your Stripe keys' as step_3;
SELECT '4. Set up Stripe Connect for the test creators' as step_4;
