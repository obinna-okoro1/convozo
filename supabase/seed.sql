-- Seed data for local development and testing
-- Password for all test users: sample123

-- Enable the pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create test users in auth.users table
-- User 1: Sarah Johnson (creator@example.com)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'creator@example.com',
  crypt('sample123', gen_salt('bf')),
  NOW(),
  '',
  '',
  '',
  '',
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Sarah Johnson"}',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- User 2: Mike Chen (creator2@example.com)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'creator2@example.com',
  crypt('sample123', gen_salt('bf')),
  NOW(),
  '',
  '',
  '',
  '',
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Mike Chen"}',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Create identities for email auth
INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) 
SELECT 
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"creator@example.com"}'::jsonb,
  'email',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE user_id = '11111111-1111-1111-1111-111111111111' AND provider = 'email'
);

INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) 
SELECT 
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"creator2@example.com"}'::jsonb,
  'email',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE user_id = '22222222-2222-2222-2222-222222222222' AND provider = 'email'
);

-- Sample Creator 1: Sarah Johnson (Single Price)
INSERT INTO public.creators (id, user_id, email, display_name, slug, bio, profile_image_url, is_active)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'creator@example.com',
  'Sarah Johnson',
  'sarahjohnson',
  'Fashion influencer & lifestyle creator. Share your brand inquiries and fan messages here!',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
  true
) ON CONFLICT (user_id) DO NOTHING;

-- Sample Creator Settings (Single Price)
INSERT INTO public.creator_settings (creator_id, has_tiered_pricing, single_price, response_expectation, auto_reply_text)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  false,
  5000, -- $50
  'I typically respond within 24-48 hours during business days.',
  'Thanks for reaching out! To send me a priority message, visit: https://convozo.com/sarahjohnson'
) ON CONFLICT (creator_id) DO NOTHING;

-- Sample Creator 2: Mike Chen (Tiered Pricing)
INSERT INTO public.creators (id, user_id, email, display_name, slug, bio, is_active)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  'creator2@example.com',
  'Mike Chen',
  'mikechen',
  'Tech reviewer & gaming enthusiast. Let''s connect!',
  true
) ON CONFLICT (user_id) DO NOTHING;

-- Sample Creator Settings (Tiered Pricing)
INSERT INTO public.creator_settings (creator_id, has_tiered_pricing, fan_price, business_price, response_expectation)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  true,
  2500, -- $25 for fans
  10000, -- $100 for business
  'Fan messages: 2-3 days. Business inquiries: 24 hours.'
) ON CONFLICT (creator_id) DO NOTHING;

-- Sample Stripe Account (Mock - not real Stripe account)
INSERT INTO public.stripe_accounts (creator_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, onboarding_completed)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'acct_test_sarahjohnson123',
  true,
  true,
  true,
  true
) ON CONFLICT (creator_id) DO NOTHING;

INSERT INTO public.stripe_accounts (creator_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, onboarding_completed)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'acct_test_mikechen456',
  true,
  true,
  true,
  true
) ON CONFLICT (creator_id) DO NOTHING;

-- Sample Messages for Sarah Johnson
INSERT INTO public.messages (id, creator_id, sender_name, sender_email, message_content, amount_paid, message_type, is_handled, created_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333',
  'John Doe',
  'john@example.com',
  'Hi Sarah! I love your content and would love to collaborate on an upcoming project. Would you be interested in discussing a partnership?',
  5000,
  'single',
  false,
  NOW() - INTERVAL '1 day'
);

INSERT INTO public.messages (id, creator_id, sender_name, sender_email, message_content, amount_paid, message_type, is_handled, reply_content, replied_at, created_at)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '33333333-3333-3333-3333-333333333333',
  'Jane Smith',
  'jane@example.com',
  'Your recent video was amazing! Can you share more about your creative process?',
  5000,
  'single',
  true,
  'Thanks so much for the kind words! I''ll definitely create a behind-the-scenes video soon.',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '2 days'
);

INSERT INTO public.messages (id, creator_id, sender_name, sender_email, message_content, amount_paid, message_type, is_handled, created_at)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333333',
  'Brand Manager',
  'partnerships@brand.com',
  'We''re interested in a sponsored content opportunity. Could we schedule a call?',
  5000,
  'single',
  false,
  NOW() - INTERVAL '3 hours'
);

-- Sample Messages for Mike Chen
INSERT INTO public.messages (id, creator_id, sender_name, sender_email, message_content, amount_paid, message_type, is_handled, created_at)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '44444444-4444-4444-4444-444444444444',
  'Gaming Fan',
  'fan@example.com',
  'Love your gaming reviews! What''s your next big review?',
  2500,
  'fan',
  false,
  NOW() - INTERVAL '5 hours'
);

INSERT INTO public.messages (id, creator_id, sender_name, sender_email, message_content, amount_paid, message_type, is_handled, reply_content, replied_at, created_at)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  '44444444-4444-4444-4444-444444444444',
  'Tech Company',
  'marketing@techco.com',
  'We''d like to send you our new gaming laptop for review. Interested?',
  10000,
  'business',
  true,
  'Absolutely! Please send me the details via email.',
  NOW() - INTERVAL '12 hours',
  NOW() - INTERVAL '1 day'
);

-- Sample Payments
INSERT INTO public.payments (message_id, creator_id, stripe_checkout_session_id, stripe_payment_intent_id, amount, platform_fee, creator_amount, status, sender_email, created_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333',
  'cs_test_a1b2c3d4e5f6g7h8i9j0',
  'pi_test_1a2b3c4d5e6f7g8h',
  5000,
  500, -- 10% platform fee
  4500,
  'completed',
  'john@example.com',
  NOW() - INTERVAL '1 day'
);

INSERT INTO public.payments (message_id, creator_id, stripe_checkout_session_id, stripe_payment_intent_id, amount, platform_fee, creator_amount, status, sender_email, created_at)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '33333333-3333-3333-3333-333333333333',
  'cs_test_z9y8x7w6v5u4t3s2r1',
  'pi_test_9z8y7x6w5v4u3t2s',
  5000,
  500,
  4500,
  'completed',
  'jane@example.com',
  NOW() - INTERVAL '2 days'
);

INSERT INTO public.payments (message_id, creator_id, stripe_checkout_session_id, stripe_payment_intent_id, amount, platform_fee, creator_amount, status, sender_email, created_at)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333333',
  'cs_test_m1n2o3p4q5r6s7t8u9',
  'pi_test_m1n2o3p4q5r6s7t8',
  5000,
  500,
  4500,
  'completed',
  'partnerships@brand.com',
  NOW() - INTERVAL '3 hours'
);

INSERT INTO public.payments (message_id, creator_id, stripe_checkout_session_id, stripe_payment_intent_id, amount, platform_fee, creator_amount, status, sender_email, created_at)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '44444444-4444-4444-4444-444444444444',
  'cs_test_f1a2n3b4o5y6z7x8c9',
  'pi_test_f1a2n3b4o5y6z7x8',
  2500,
  250,
  2250,
  'completed',
  'fan@example.com',
  NOW() - INTERVAL '5 hours'
);

INSERT INTO public.payments (message_id, creator_id, stripe_checkout_session_id, stripe_payment_intent_id, amount, platform_fee, creator_amount, status, sender_email, created_at)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  '44444444-4444-4444-4444-444444444444',
  'cs_test_b1u2s3i4n5e6s7s8t9',
  'pi_test_b1u2s3i4n5e6s7s8',
  10000,
  1000,
  9000,
  'completed',
  'marketing@techco.com',
  NOW() - INTERVAL '1 day'
);

-- Output summary
SELECT 'Seed data inserted successfully!' as message;
SELECT '✅ Created 2 test users (password: sample123)' as info_1;
SELECT '✅ Created 2 creators with settings' as info_2;
SELECT '✅ Created 5 sample messages' as info_3;
SELECT '✅ Created 5 sample payments' as info_4;
SELECT '' as separator;
SELECT 'Test Users:' as users_header;
SELECT '- creator@example.com (Sarah Johnson) - Single pricing: $50' as user_1;
SELECT '- creator2@example.com (Mike Chen) - Tiered pricing: $25/$100' as user_2;
SELECT '2. Sign up through the app to create auth users first' as step_2;
SELECT '3. Update the environment variables with your Stripe keys' as step_3;
SELECT '4. Set up Stripe Connect for the test creators' as step_4;
