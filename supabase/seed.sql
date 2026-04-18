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

-- Client test users — needed for get-client-portal integration tests.
-- These are NOT creators; they're the clients who sent messages.
-- User 3: John Doe (john@example.com) — sent messages to sarahjohnson
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-000000000000',
  'john@example.com',
  crypt('clienttest123', gen_salt('bf')),
  NOW(), '', '', '', '', NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"John Doe"}',
  'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","email":"john@example.com"}'::jsonb,
  'email', NOW(), NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND provider = 'email'
);

-- User 4: Gaming Fan (fan@example.com) — sent messages to mikechen
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '00000000-0000-0000-0000-000000000000',
  'fan@example.com',
  crypt('clienttest456', gen_salt('bf')),
  NOW(), '', '', '', '', NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Gaming Fan"}',
  'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","email":"fan@example.com"}'::jsonb,
  'email', NOW(), NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND provider = 'email'
);

-- Sample Creator 1: The Rock (Real Instagram Profile Data)
-- Note: In production, use a third-party Instagram API service to fetch real-time data
INSERT INTO public.creators (id, user_id, email, display_name, slug, bio, profile_image_url, phone_number, is_active)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'creator@example.com',
  'Dwayne Johnson',
  'sarahjohnson',
  'builder of stuff cheat meal crusher tequila sipper og girl dad 💕',
  'https://i.pravatar.cc/400?img=33',
  '+1 310-555-0199',
  true
) ON CONFLICT (user_id) DO NOTHING;

-- Sample Creator Settings (Single Pricing + Calls)
INSERT INTO public.creator_settings (creator_id, message_price, call_price, call_duration, calls_enabled, messages_enabled, tips_enabled, response_expectation, auto_reply_text)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  1000, -- $10 for messages
  5000, -- $50 for 30min calls
  30, -- 30 minutes
  true, -- calls enabled
  true, -- messages enabled (required for Consult tab to appear in Cypress tests)
  true, -- tips enabled (required for Support tab to appear in Cypress tests)
  '24-48 hours',
  'Thanks for reaching out! To send me a priority message, visit: https://convozo.com/sarahjohnson'
) ON CONFLICT (creator_id) DO NOTHING;

-- Sample Creator 2: Cristiano Ronaldo (Real Instagram Profile Data)
-- Note: In production, use a third-party Instagram API service to fetch real-time data
INSERT INTO public.creators (id, user_id, email, display_name, slug, bio, profile_image_url, phone_number, is_active)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  'creator2@example.com',
  'Cristiano Ronaldo',
  'mikechen',
  'Passion & Joy ⚽️❤️',
  'https://i.pravatar.cc/400?img=12',
  '+351 912-345-678',
  true
) ON CONFLICT (user_id) DO NOTHING;

-- Sample Creator Settings (Messages Only)
INSERT INTO public.creator_settings (creator_id, message_price, calls_enabled, response_expectation)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  500, -- $5 for messages
  false, -- calls disabled
  'Fan messages: 2-3 days. Business inquiries: 24 hours.'
) ON CONFLICT (creator_id) DO NOTHING;

-- NOTE: Stripe accounts are NOT seeded — creators must connect their Stripe
-- account through the normal onboarding flow (Settings → Payments → Connect Stripe).

-- Sample Messages for Sarah Johnson
INSERT INTO public.messages (id, creator_id, sender_name, sender_email, message_content, amount_paid, message_type, is_handled, created_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333',
  'John Doe',
  'john@example.com',
  'Hi Sarah! I love your content and would love to collaborate on an upcoming project. Would you be interested in discussing a partnership?',
  1000,
  'message',
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
  1000,
  'message',
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
  1000,
  'message',
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
  500,
  'message',
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
  500,
  'message',
  true,
  'Absolutely! Please send me the details via email.',
  NOW() - INTERVAL '12 hours',
  NOW() - INTERVAL '1 day'
);

-- Sample Payments
INSERT INTO public.payments (message_id, creator_id, stripe_session_id, stripe_payment_intent_id, amount, platform_fee, creator_amount, status, sender_email, created_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333',
  'cs_test_a1b2c3d4e5f6g7h8i9j0',
  'pi_1234567',
  1000,
  220, -- 22% platform fee
  780,
  'completed',
  'john@example.com',
  NOW() - INTERVAL '1 day'
);

INSERT INTO public.payments (message_id, creator_id, stripe_session_id, stripe_payment_intent_id, amount, platform_fee, creator_amount, status, sender_email, created_at)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '33333333-3333-3333-3333-333333333333',
  'cs_test_z9y8x7w6v5u4t3s2r1',
  'pi_1234568',
  1000,
  220,
  780,
  'completed',
  'jane@example.com',
  NOW() - INTERVAL '2 days'
);

INSERT INTO public.payments (message_id, creator_id, stripe_session_id, stripe_payment_intent_id, amount, platform_fee, creator_amount, status, sender_email, created_at)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333333',
  'cs_test_m1n2o3p4q5r6s7t8u9',
  'pi_1234569',
  1000,
  220,
  780,
  'completed',
  'partnerships@brand.com',
  NOW() - INTERVAL '3 hours'
);

INSERT INTO public.payments (message_id, creator_id, stripe_session_id, stripe_payment_intent_id, amount, platform_fee, creator_amount, status, sender_email, created_at)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '44444444-4444-4444-4444-444444444444',
  'cs_test_f1a2n3b4o5y6z7x8c9',
  'pi_1234570',
  500,
  110,
  390,
  'completed',
  'fan@example.com',
  NOW() - INTERVAL '5 hours'
);

INSERT INTO public.payments (message_id, creator_id, stripe_session_id, stripe_payment_intent_id, amount, platform_fee, creator_amount, status, sender_email, created_at)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  '44444444-4444-4444-4444-444444444444',
  'cs_test_b1u2s3i4n5e6s7s8t9',
  'pi_1234571',
  500,
  110,
  390,
  'completed',
  'marketing@techco.com',
  NOW() - INTERVAL '1 day'
);

-- Sample Availability Slots for Sarah Johnson (Monday-Friday, 9AM-5PM)
INSERT INTO public.availability_slots (creator_id, day_of_week, start_time, end_time, is_active)
VALUES 
  ('33333333-3333-3333-3333-333333333333', 1, '09:00', '12:00', true), -- Monday morning
  ('33333333-3333-3333-3333-333333333333', 1, '14:00', '17:00', true), -- Monday afternoon
  ('33333333-3333-3333-3333-333333333333', 2, '09:00', '12:00', true), -- Tuesday morning
  ('33333333-3333-3333-3333-333333333333', 2, '14:00', '17:00', true), -- Tuesday afternoon
  ('33333333-3333-3333-3333-333333333333', 3, '09:00', '12:00', true), -- Wednesday morning
  ('33333333-3333-3333-3333-333333333333', 3, '14:00', '17:00', true), -- Wednesday afternoon
  ('33333333-3333-3333-3333-333333333333', 4, '09:00', '12:00', true), -- Thursday morning
  ('33333333-3333-3333-3333-333333333333', 4, '14:00', '17:00', true), -- Thursday afternoon
  ('33333333-3333-3333-3333-333333333333', 5, '09:00', '12:00', true), -- Friday morning
  ('33333333-3333-3333-3333-333333333333', 5, '14:00', '17:00', true); -- Friday afternoon

-- Sample Call Booking with Daily.co room
INSERT INTO public.call_bookings (
  creator_id, booker_name, booker_email, scheduled_at, duration, amount_paid,
  status, stripe_session_id, stripe_payment_intent_id, created_at,
  daily_room_name, daily_room_url, creator_meeting_token, fan_meeting_token, payout_status
)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'Alex Rodriguez',
  'alex@example.com',
  NOW() + INTERVAL '3 days' + INTERVAL '10 hours', -- 3 days from now at 10 AM
  30,
  5000,
  'confirmed',
  'cs_test_call_1a2b3c4d',
  'pi_1234572',
  NOW() - INTERVAL '2 hours',
  'convozo-test-call-001',
  'https://convozo.daily.co/convozo-test-call-001',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyIjoiY29udm96by10ZXN0LWNhbGwtMDAxIiwibyI6dHJ1ZSwidSI6IlNhcmFoIEpvaG5zb24iLCJleHAiOjk5OTk5OTk5OTksImQiOiJmYTFhODEwMS05MmZiLTQxOTMtOWEzMS01N2Q0MTY5M2Y3MzUiLCJpYXQiOjE3NzM0MzczMjV9.fEPoTwSVp-mrwITuqwOVW4OLMNoB-fJewI_TZxRe834',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyIjoiY29udm96by10ZXN0LWNhbGwtMDAxIiwibyI6ZmFsc2UsInUiOiJBbGV4IFJvZHJpZ3VleiIsImV4cCI6OTk5OTk5OTk5OSwiZCI6ImZhMWE4MTAxLTkyZmItNDE5My05YTMxLTU3ZDQxNjkzZjczNSIsImlhdCI6MTc3MzQzNzMyNX0.AKcRfjP5M8KrjncXhCO5Q8ba0KuIH3UOpAW_lWfTh38',
  'held'
);

-- Set theme colors on creators
UPDATE public.creators SET theme_color = '#7c3aed' WHERE id = '33333333-3333-3333-3333-333333333333';
UPDATE public.creators SET theme_color = '#e11d48' WHERE id = '44444444-4444-4444-4444-444444444444';

-- Sample Links for Sarah Johnson (Dwayne Johnson)
INSERT INTO public.creator_links (id, creator_id, title, url, icon, position, is_active, click_count, created_at)
VALUES
  ('aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'My YouTube Channel', 'https://youtube.com/@therock', 'youtube', 0, true, 4820,
   NOW() - INTERVAL '30 days'),
  ('aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'Follow me on Instagram', 'https://instagram.com/therock', 'instagram', 1, true, 3150,
   NOW() - INTERVAL '28 days'),
  ('aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'TikTok', 'https://tiktok.com/@therock', 'tiktok', 2, true, 2740,
   NOW() - INTERVAL '25 days'),
  ('aaaaaaaa-0004-0004-0004-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'Teremana Tequila', 'https://teremana.com', null, 3, true, 1580,
   NOW() - INTERVAL '20 days'),
  ('aaaaaaaa-0005-0005-0005-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'My Twitter / X', 'https://x.com/therock', 'twitter', 4, true, 960,
   NOW() - INTERVAL '18 days'),
  ('aaaaaaaa-0006-0006-0006-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'Listen on Spotify', 'https://open.spotify.com/artist/therock', 'spotify', 5, true, 430,
   NOW() - INTERVAL '10 days'),
  ('aaaaaaaa-0007-0007-0007-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'Support on Patreon', 'https://patreon.com/therock', 'patreon', 6, false, 85,
   NOW() - INTERVAL '5 days');

-- Sample Links for Mike Chen (Cristiano Ronaldo)
INSERT INTO public.creator_links (id, creator_id, title, url, icon, position, is_active, click_count, created_at)
VALUES
  ('bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444',
   'My YouTube', 'https://youtube.com/@cristiano', 'youtube', 0, true, 7200,
   NOW() - INTERVAL '45 days'),
  ('bbbbbbbb-0002-0002-0002-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444',
   'Instagram', 'https://instagram.com/cristiano', 'instagram', 1, true, 12400,
   NOW() - INTERVAL '40 days'),
  ('bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444',
   'Follow on X', 'https://x.com/cristiano', 'twitter', 2, true, 3800,
   NOW() - INTERVAL '35 days'),
  ('bbbbbbbb-0004-0004-0004-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444',
   'CR7 on Facebook', 'https://facebook.com/cristiano', 'facebook', 3, true, 2100,
   NOW() - INTERVAL '30 days'),
  ('bbbbbbbb-0005-0005-0005-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444',
   'My Official Website', 'https://www.cristianoronaldo.com', null, 4, true, 950,
   NOW() - INTERVAL '20 days');

-- Sample Link Clicks (recent activity for Sarah's YouTube link)
INSERT INTO public.link_clicks (link_id, creator_id, referrer, user_agent, created_at)
SELECT
  'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333',
  CASE (random() * 3)::int
    WHEN 0 THEN 'https://instagram.com'
    WHEN 1 THEN 'https://google.com'
    WHEN 2 THEN null
    ELSE 'https://twitter.com'
  END,
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  NOW() - (random() * INTERVAL '30 days')
FROM generate_series(1, 25);

-- Sample Link Clicks for Sarah's Instagram link
INSERT INTO public.link_clicks (link_id, creator_id, referrer, user_agent, created_at)
SELECT
  'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333',
  null,
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  NOW() - (random() * INTERVAL '30 days')
FROM generate_series(1, 15);

-- ============================================================================
-- SAMPLE SHOP DATA (Digital Shop)
-- ============================================================================

-- Enable shop for Sarah Johnson
UPDATE public.creator_settings
SET shop_enabled = true
WHERE creator_id = '33333333-3333-3333-3333-333333333333';

-- Enable shop for Mike Chen
UPDATE public.creator_settings
SET shop_enabled = true
WHERE creator_id = '44444444-4444-4444-4444-444444444444';

-- Sarah's Shop Items (9 products)
INSERT INTO public.shop_items (
  id, creator_id, title, description, price, item_type, file_url, thumbnail_url,
  preview_text, delivery_note, is_active, is_request_based, sort_order, created_at
) VALUES
  -- Video products
  ('cccccccc-0001-0001-0001-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Complete Fitness Workout Guide', 'Full-body 30-minute workout video with modifications for all levels',
   2999, 'video', 'https://example.com/downloads/workout-30min.mp4',
   null, 'HD 1080p, 30 minutes',
   'Digital download link sent immediately', true, false, 1, NOW() - INTERVAL '60 days'),
  
  ('cccccccc-0002-0002-0002-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Instagram Reel Templates (20)', 'Ready-to-use Adobe Premiere Pro templates for creating viral reels',
   1999, 'video', 'https://example.com/downloads/reels-templates-20.zip',
   null, 'Premiere Pro format, fully editable',
   'ZIP download sent to email immediately', true, false, 2, NOW() - INTERVAL '50 days'),
  
  -- Audio products
  ('cccccccc-0003-0003-0003-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Meditation Session (45 min)', 'Guided meditation for stress relief and deep relaxation',
   1499, 'audio', 'https://example.com/downloads/meditation-45min.m4a',
   null, '45 minutes, high quality',
   'Audio file download sent immediately', true, false, 3, NOW() - INTERVAL '45 days'),
  
  ('cccccccc-0004-0004-0004-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Podcast Production Masterclass', 'Audio guide on recording, editing, and distributing podcasts',
   2499, 'audio', 'https://example.com/downloads/podcast-masterclass.zip',
   null, 'Multi-part guide, MP3 + PDF',
   'Compressed ZIP sent to email', true, false, 4, NOW() - INTERVAL '40 days'),
  
  -- PDF products
  ('cccccccc-0005-0005-0005-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Social Media Growth Strategy (2024)', '50-page guide to growing followers and engagement on Instagram, TikTok & YouTube',
   999, 'pdf', 'https://example.com/downloads/sm-growth-2024.pdf',
   null, '50 pages, actionable tactics',
   'PDF link sent immediately', true, false, 5, NOW() - INTERVAL '35 days'),
  
  ('cccccccc-0006-0006-0006-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Email Marketing Templates', 'Canva templates for professional email campaigns and newsletters',
   799, 'pdf', 'https://example.com/downloads/email-templates.pdf',
   null, '15 customizable templates',
   'PDF download sent to email', true, false, 6, NOW() - INTERVAL '30 days'),
  
  -- Image products
  ('cccccccc-0007-0007-0007-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Stock Photo Collection (100)', 'High-resolution lifestyle and portrait photos for content creators',
   1499, 'image', 'https://example.com/downloads/stock-photos-100.zip',
   null, 'High-res JPG, commercial license',
   'ZIP archive sent to email', true, false, 7, NOW() - INTERVAL '25 days'),
  
  -- Request-based product (shoutout)
  ('cccccccc-0008-0008-0008-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Personalized Shoutout Video', 'Custom 30-second video shoutout recorded just for you',
   5000, 'shoutout_request', null, null,
   'Custom video, 30 seconds max', 'Delivered within 3-5 business days',
   true, true, 8, NOW() - INTERVAL '20 days'),
  
  -- Another video product (inactive draft)
  ('cccccccc-0009-0009-0009-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Advanced Video Editing Course (Coming Soon)', 'Professional techniques for cinematic video production',
   3999, 'video', null, null,
   'Full course with exercises', 'Coming soon - pre-order available',
   false, false, 9, NOW() - INTERVAL '5 days');

-- Mike's Shop Items (3 products)
INSERT INTO public.shop_items (
  id, creator_id, title, description, price, item_type, file_url, thumbnail_url,
  preview_text, delivery_note, is_active, is_request_based, sort_order, created_at
) VALUES
  ('cccccccc-1001-1001-1001-cccccccccccc', '44444444-4444-4444-4444-444444444444',
   'Music Production Samples Pack', 'Royalty-free drum kits, synths, and loops for EDM production',
   1299, 'audio', 'https://example.com/downloads/edm-samples.zip',
   null, '2GB of samples, WAV format',
   'ZIP download sent immediately', true, false, 1, NOW() - INTERVAL '40 days'),
  
  ('cccccccc-1002-1002-1002-cccccccccccc', '44444444-4444-4444-4444-444444444444',
   'YouTube SEO Checklist', '25-point checklist for optimizing videos and channel for discovery',
   599, 'pdf', 'https://example.com/downloads/youtube-seo.pdf',
   null, 'Printable PDF checklist',
   'PDF sent immediately', true, false, 2, NOW() - INTERVAL '25 days'),
  
  ('cccccccc-1003-1003-1003-cccccccccccc', '44444444-4444-4444-4444-444444444444',
   'Beat Tape (10 Exclusive Beats)', 'Original hip-hop and R&B instrumental beats exclusive on this store',
   2499, 'audio', 'https://example.com/downloads/beat-tape-10.zip',
   null, 'MP3 + WAV, commercial license included',
   'Compressed ZIP sent to email', true, false, 3, NOW() - INTERVAL '15 days');

-- Sample Shop Orders (purchases for testing)
INSERT INTO public.shop_orders (
  id, item_id, creator_id, buyer_name, buyer_email, amount_paid,
  stripe_session_id, idempotency_key, status, request_details, created_at
) VALUES
  ('dddddddd-0001-0001-0001-dddddddddddd',
   'cccccccc-0001-0001-0001-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Alex Thompson', 'alex.thompson@example.com', 2999,
   'cs_test_a1b2c3d4e5f6g7h8', 'idempotency_order_001',
   'completed', null, NOW() - INTERVAL '10 days'),
  
  ('dddddddd-0002-0002-0002-dddddddddddd',
   'cccccccc-0005-0005-0005-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Jordan Smith', 'jordan.smith@example.com', 999,
   'cs_test_a1b2c3d4e5f6g7h9', 'idempotency_order_002',
   'completed', null, NOW() - INTERVAL '8 days'),
  
  ('dddddddd-0003-0003-0003-dddddddddddd',
   'cccccccc-0008-0008-0008-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Casey Robinson', 'casey.robinson@example.com', 5000,
   'cs_test_a1b2c3d4e5f6g7h10', 'idempotency_order_003',
   'pending', 'Please do a funny birthday shoutout for my friend Tom with a silly accent!',
   NOW() - INTERVAL '5 days'),
  
  ('dddddddd-0004-0004-0004-dddddddddddd',
   'cccccccc-1001-1001-1001-cccccccccccc', '44444444-4444-4444-4444-444444444444',
   'Taylor Davis', 'taylor.davis@example.com', 1299,
   'cs_test_a1b2c3d4e5f6g7h11', 'idempotency_order_004',
   'completed', null, NOW() - INTERVAL '3 days'),
  
  ('dddddddd-0005-0005-0005-dddddddddddd',
   'cccccccc-0002-0002-0002-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Morgan Lee', 'morgan.lee@example.com', 1999,
   'cs_test_a1b2c3d4e5f6g7h12', 'idempotency_order_005',
   'completed', null, NOW() - INTERVAL '2 days');

-- Sample Posts for Sarah Johnson
INSERT INTO public.creator_posts (id, creator_id, title, content, is_published, created_at, updated_at) VALUES
  ('eeeeeeee-0001-0001-0001-eeeeeeeeeeee',
   '33333333-3333-3333-3333-333333333333',
   'How I structure my client consultations',
   'Every session I do starts with 10 minutes of pure listening. No advice, no frameworks — just understanding what the person actually needs. Most problems reveal their own solutions once you slow down enough to hear them clearly.',
   true, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

  ('eeeeeeee-0002-0002-0002-eeeeeeeeeeee',
   '33333333-3333-3333-3333-333333333333',
   'The one question that changes everything',
   'Before any client books with me, I ask them: "What would success look like 90 days from now?" Not tomorrow. Not "I want to feel better." Ninety days. That single question separates people who are ready to do the work from people who just want to vent.',
   true, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

  ('eeeeeeee-0003-0003-0003-eeeeeeeeeeee',
   '33333333-3333-3333-3333-333333333333',
   'On boundaries and energy management',
   'I used to take calls on Sunday evenings. My availability looked impressive. My burnout wasn''t. Setting hard stop times isn''t selfishness — it''s how you stay sharp for the clients who deserve your best thinking.',
   true, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),

  ('eeeeeeee-0004-0004-0004-eeeeeeeeeeee',
   '33333333-3333-3333-3333-333333333333',
   'Three signs a client is ready to level up',
   'They stop asking "what should I do" and start asking "here''s what I''m thinking — what am I missing?" That shift from seeking answers to refining thinking is everything. That''s when our sessions go from good to genuinely transformative.',
   true, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),

  ('eeeeeeee-0005-0005-0005-eeeeeeeeeeee',
   '33333333-3333-3333-3333-333333333333',
   NULL,
   'Reminder: your first session with any expert should feel slightly uncomfortable. Not because they''re being harsh — because growth lives just outside your current comfort zone. If every conversation feels easy, you''re probably not being challenged enough.',
   true, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days');

-- ============================================================================
-- STRIPE ACCOUNT (unlocks Inbox / Analytics / Bookings / Availability tabs)
-- ============================================================================

-- Fake Stripe Connect account for Sarah Johnson so the dashboard shows all tabs.
-- In production this is created via the create-connect-account Edge Function.
INSERT INTO public.stripe_accounts (
  creator_id, stripe_account_id,
  charges_enabled, payouts_enabled, details_submitted, onboarding_completed
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  'acct_test_sarahjohnson_dev',
  true,  -- charges_enabled → unlocks Inbox, Analytics, Bookings, Availability tabs
  true,
  true,
  true
) ON CONFLICT (creator_id) DO NOTHING;

-- ============================================================================
-- EXPERT CREDENTIALS (migration 041 fields)
-- ============================================================================

-- Sarah Johnson — Family Law Attorney
UPDATE public.creators SET
  category            = 'legal',
  subcategory         = 'family_law',
  profession_title    = 'Senior Family Law Attorney',
  years_of_experience = 12,
  linkedin_url        = 'https://linkedin.com/in/sarah-johnson-esq'
WHERE id = '33333333-3333-3333-3333-333333333333';

-- Mike Chen — Life & Performance Coach
UPDATE public.creators SET
  category            = 'mental_health',
  subcategory         = 'life_coach',
  profession_title    = 'ICF-Certified Life & Performance Coach',
  years_of_experience = 8,
  linkedin_url        = 'https://linkedin.com/in/mike-chen-coach'
WHERE id = '44444444-4444-4444-4444-444444444444';

-- ============================================================================
-- HISTORICAL MESSAGES + PAYMENTS (last 6 months)
-- The payments trigger (migration 031) auto-populates creator_monthly_analytics.
-- Growing trend: 5 → 8 → 11 → 14 → 18 → 22 paid messages per month.
-- Each month also gets 2 support tips and (from month 4 back) 1 completed call.
-- All monetary values are integer cents. No floating point.
-- ============================================================================

DO $$
DECLARE
  v_msg_id    UUID;
  v_month     DATE;
  v_offset    INT;
  v_msg_count INT;
BEGIN
  -- v_offset 5 = 5 months ago, 0 = current month
  FOR v_offset IN REVERSE 5..0 LOOP
    v_month := DATE_TRUNC('month', NOW() - (v_offset * INTERVAL '1 month'))::DATE;

    v_msg_count := CASE v_offset
      WHEN 5 THEN 5
      WHEN 4 THEN 8
      WHEN 3 THEN 11
      WHEN 2 THEN 14
      WHEN 1 THEN 18
      WHEN 0 THEN 22
      ELSE 5
    END;

    -- ── Paid consultation messages ──────────────────────────────────────────
    FOR i IN 1..v_msg_count LOOP
      v_msg_id := gen_random_uuid();

      INSERT INTO public.messages (
        id, creator_id, sender_name, sender_email, message_content,
        amount_paid, message_type, is_handled, created_at
      ) VALUES (
        v_msg_id,
        '33333333-3333-3333-3333-333333333333',
        'Client ' || i,
        'hist_' || i || '_mo' || v_offset || '@example.com',
        'I need legal guidance on my situation. Here are the details of my case — please let me know if you can help.',
        1000,   -- $10.00 in cents
        'message',
        (i < v_msg_count),  -- keep last message of each month unhandled for inbox testing
        v_month + ((i - 1) * INTERVAL '18 hours' + INTERVAL '9 hours')
      );

      -- Payment insert fires trg_analytics_on_payment → updates creator_monthly_analytics
      INSERT INTO public.payments (
        message_id, creator_id,
        stripe_session_id, stripe_payment_intent_id,
        amount, platform_fee, creator_amount, status, sender_email, created_at
      ) VALUES (
        v_msg_id,
        '33333333-3333-3333-3333-333333333333',
        'cs_hist_' || v_msg_id::text,
        'pi_hist_' || replace(v_msg_id::text, '-', ''),
        1000,   -- gross cents
        220,    -- 22% platform fee (integer, no floating point)
        780,    -- 78% creator net
        'completed',
        'hist_' || i || '_mo' || v_offset || '@example.com',
        v_month + ((i - 1) * INTERVAL '18 hours' + INTERVAL '9 hours')
      );
    END LOOP;

    -- ── Support tips (2 per month) ──────────────────────────────────────────
    FOR i IN 1..2 LOOP
      v_msg_id := gen_random_uuid();

      INSERT INTO public.messages (
        id, creator_id, sender_name, sender_email, message_content,
        amount_paid, message_type, is_handled, created_at
      ) VALUES (
        v_msg_id,
        '33333333-3333-3333-3333-333333333333',
        'Grateful Client ' || i,
        'tip_' || i || '_mo' || v_offset || '@example.com',
        'Thank you so much for your advice — it made a real difference to my case!',
        500,    -- $5.00 tip in cents
        'support',
        true,
        v_month + INTERVAL '15 days' + (i * INTERVAL '3 hours')
      );

      INSERT INTO public.payments (
        message_id, creator_id,
        stripe_session_id, stripe_payment_intent_id,
        amount, platform_fee, creator_amount, status, sender_email, created_at
      ) VALUES (
        v_msg_id,
        '33333333-3333-3333-3333-333333333333',
        'cs_tip_' || v_msg_id::text,
        'pi_tip_' || replace(v_msg_id::text, '-', ''),
        500,    -- $5.00 cents
        110,    -- 22% of 500
        390,    -- 78% of 500
        'completed',
        'tip_' || i || '_mo' || v_offset || '@example.com',
        v_month + INTERVAL '15 days' + (i * INTERVAL '3 hours')
      );
    END LOOP;

    -- ── Completed call bookings (1 per month, starting 4 months ago) ────────
    -- payout_status = 'released' fires the call booking analytics trigger
    IF v_offset <= 4 THEN
      v_msg_id := gen_random_uuid();  -- reused as booking id

      INSERT INTO public.call_bookings (
        id, creator_id, booker_name, booker_email,
        scheduled_at, duration, amount_paid, status,
        stripe_session_id, stripe_payment_intent_id,
        payout_status, created_at
      ) VALUES (
        v_msg_id,
        '33333333-3333-3333-3333-333333333333',
        'Call Client ' || (6 - v_offset),
        'call_' || (6 - v_offset) || '@example.com',
        v_month + INTERVAL '12 days' + INTERVAL '14 hours',
        30,     -- 30-minute call
        5000,   -- $50.00 in cents
        'completed',
        'cs_call_' || v_msg_id::text,
        'pi_call_' || replace(v_msg_id::text, '-', ''),
        'released',   -- triggers call analytics update for this month
        v_month + INTERVAL '12 days' + INTERVAL '14 hours'
      );
    END IF;

  END LOOP;
END $$;

-- ============================================================================
-- THREADED INBOX REPLIES (tests message_replies / threaded inbox feature)
-- ============================================================================

-- Thread on John Doe's collaboration message (55555555...)
INSERT INTO public.message_replies (message_id, sender_type, content, created_at)
VALUES
  ('55555555-5555-5555-5555-555555555555', 'expert',
   'Hi John! Happy to explore this. What''s the scope and which brand is involved? If you have a brief you can share, I''ll take a look.',
   NOW() - INTERVAL '22 hours'),
  ('55555555-5555-5555-5555-555555555555', 'client',
   'It''s a 6-week content series for a wellness brand launching Q2. Budget is flexible based on deliverables. I''ll send the brief over now.',
   NOW() - INTERVAL '20 hours'),
  ('55555555-5555-5555-5555-555555555555', 'expert',
   'Perfect — send it through and I''ll review within 24 hours. Looking forward to seeing the details.',
   NOW() - INTERVAL '18 hours');

-- Thread on the Brand Manager partnership message (77777777...)
INSERT INTO public.message_replies (message_id, sender_type, content, created_at)
VALUES
  ('77777777-7777-7777-7777-777777777777', 'expert',
   'Thanks for reaching out. Happy to discuss this. What product category, and what kind of deliverables are you envisioning?',
   NOW() - INTERVAL '2 hours'),
  ('77777777-7777-7777-7777-777777777777', 'client',
   'We''re a premium fitness supplements brand. Ideally 2 posts and a reel per month for a 3-month campaign.',
   NOW() - INTERVAL '1 hour');
-- ============================================================================
-- NIGERIAN FLUTTERWAVE CREATOR (User 5: Chioma Okafor)
-- Used by Flutterwave integration tests — must remain country=NG, payment_provider=flutterwave.
-- Do NOT change to Stripe; Stripe creator tests use sarahjohnson exclusively.
-- ============================================================================

-- Auth user for Chioma
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '00000000-0000-0000-0000-000000000000',
  'chioma@example.com',
  crypt('sample123', gen_salt('bf')),
  NOW(), '', '', '', '', NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Chioma Okafor"}',
  'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","email":"chioma@example.com"}'::jsonb,
  'email', NOW(), NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' AND provider = 'email'
);

-- Creator profile — Nigerian, Flutterwave payment provider
INSERT INTO public.creators (
  id, user_id, email, display_name, slug, bio,
  profile_image_url, phone_number, is_active,
  country, payment_provider
) VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'chioma@example.com',
  'Chioma Okafor',
  'chiomaokafor',
  'Lagos-based business consultant • helping African startups scale 🚀',
  'https://i.pravatar.cc/400?img=45',
  '+234 802-555-0199',
  true,
  'NG',
  'flutterwave'
) ON CONFLICT (user_id) DO NOTHING;

-- Creator settings — messages + calls enabled
INSERT INTO public.creator_settings (
  creator_id, message_price, call_price, call_duration,
  calls_enabled, messages_enabled, tips_enabled, response_expectation
) VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  1000,  -- $10 for messages (USD cents)
  5000,  -- $50 for 30min calls (USD cents)
  30,
  true, true, true,
  '24-48 hours'
) ON CONFLICT (creator_id) DO NOTHING;

-- Expert credentials
UPDATE public.creators SET
  category            = 'business',
  subcategory         = 'startup_consulting',
  profession_title    = 'Startup Growth Consultant',
  years_of_experience = 7,
  linkedin_url        = 'https://linkedin.com/in/chioma-okafor'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

-- Flutterwave subaccount — fake ID for local testing
INSERT INTO public.flutterwave_subaccounts (
  creator_id, subaccount_id, business_name, bank_name,
  bank_code, account_number, country, is_active, account_name
) VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'RS_TEST_CHIOMA_DEV',
  'Chioma Okafor Consulting',
  'Access Bank',
  '044',
  '1234567890',
  'NG',
  true,
  'CHIOMA OKAFOR'
) ON CONFLICT (creator_id) DO NOTHING;
-- Output summary
SELECT 'Seed data inserted successfully!' as message;
SELECT '✅ Created 2 test users (password: sample123)' as info_1;
SELECT '✅ Created 2 creators with settings and expert credentials' as info_2;
SELECT '✅ Created stripe_account for Sarah (dashboard tabs unlocked)' as info_3;
SELECT '✅ Created 5 base messages + 5 payments' as info_4;
SELECT '✅ Created ~78 historical messages + payments (6 months)' as info_5;
SELECT '✅ Created 10 support tips across 6 months' as info_6;
SELECT '✅ Created 5 historical call bookings (payout_status=released)' as info_7;
SELECT '✅ Created 5 message_replies (2 threads in inbox)' as info_8;
SELECT '✅ Created availability slots for Sarah' as info_9;
SELECT '✅ Created 1 upcoming call booking (confirmed)' as info_10;
SELECT '✅ Created 12 sample links + 40 link clicks' as info_11;
SELECT '✅ Created 12 shop items + 5 shop orders' as info_12;
SELECT '✅ Created 5 posts for Sarah Johnson' as info_13;
SELECT '✅ creator_monthly_analytics auto-populated via triggers' as info_14;
SELECT '' as separator;
SELECT 'Test Users:' as users_header;
SELECT '  creator@example.com  / sample123  →  Sarah Johnson (Family Law Attorney)' as user_1;
SELECT '  creator2@example.com / sample123  →  Mike Chen (Life Coach)' as user_2;
SELECT '' as separator2;
SELECT 'Sarah''s dashboard: all tabs visible (Inbox / Analytics / Bookings / Availability / Links)' as tabs_note;
SELECT 'Analytics: ~6 months of growing revenue data — check the Analytics tab' as analytics_note;
