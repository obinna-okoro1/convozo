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
INSERT INTO public.creator_settings (creator_id, message_price, call_price, call_duration, calls_enabled, response_expectation, auto_reply_text)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  1000, -- $10 for messages
  5000, -- $50 for 30min calls
  30, -- 30 minutes
  true, -- calls enabled
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
   'https://example.com/thumbnails/workout-thumb.jpg', 'HD 1080p, 30 minutes',
   'Digital download link sent immediately', true, false, 1, NOW() - INTERVAL '60 days'),
  
  ('cccccccc-0002-0002-0002-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Instagram Reel Templates (20)', 'Ready-to-use Adobe Premiere Pro templates for creating viral reels',
   1999, 'video', 'https://example.com/downloads/reels-templates-20.zip',
   'https://example.com/thumbnails/reels-thumb.jpg', 'Premiere Pro format, fully editable',
   'ZIP download sent to email immediately', true, false, 2, NOW() - INTERVAL '50 days'),
  
  -- Audio products
  ('cccccccc-0003-0003-0003-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Meditation Session (45 min)', 'Guided meditation for stress relief and deep relaxation',
   1499, 'audio', 'https://example.com/downloads/meditation-45min.m4a',
   'https://example.com/thumbnails/meditation-thumb.jpg', '45 minutes, high quality',
   'Audio file download sent immediately', true, false, 3, NOW() - INTERVAL '45 days'),
  
  ('cccccccc-0004-0004-0004-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Podcast Production Masterclass', 'Audio guide on recording, editing, and distributing podcasts',
   2499, 'audio', 'https://example.com/downloads/podcast-masterclass.zip',
   'https://example.com/thumbnails/podcast-thumb.jpg', 'Multi-part guide, MP3 + PDF',
   'Compressed ZIP sent to email', true, false, 4, NOW() - INTERVAL '40 days'),
  
  -- PDF products
  ('cccccccc-0005-0005-0005-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Social Media Growth Strategy (2024)', '50-page guide to growing followers and engagement on Instagram, TikTok & YouTube',
   999, 'pdf', 'https://example.com/downloads/sm-growth-2024.pdf',
   'https://example.com/thumbnails/smgrowth-thumb.jpg', '50 pages, actionable tactics',
   'PDF link sent immediately', true, false, 5, NOW() - INTERVAL '35 days'),
  
  ('cccccccc-0006-0006-0006-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Email Marketing Templates', 'Canva templates for professional email campaigns and newsletters',
   799, 'pdf', 'https://example.com/downloads/email-templates.pdf',
   'https://example.com/thumbnails/email-thumb.jpg', '15 customizable templates',
   'PDF download sent to email', true, false, 6, NOW() - INTERVAL '30 days'),
  
  -- Image products
  ('cccccccc-0007-0007-0007-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Stock Photo Collection (100)', 'High-resolution lifestyle and portrait photos for content creators',
   1499, 'image', 'https://example.com/downloads/stock-photos-100.zip',
   'https://example.com/thumbnails/stock-thumb.jpg', 'High-res JPG, commercial license',
   'ZIP archive sent to email', true, false, 7, NOW() - INTERVAL '25 days'),
  
  -- Request-based product (shoutout)
  ('cccccccc-0008-0008-0008-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Personalized Shoutout Video', 'Custom 30-second video shoutout recorded just for you',
   5000, 'shoutout_request', null, 'https://example.com/thumbnails/shoutout-thumb.jpg',
   'Custom video, 30 seconds max', 'Delivered within 3-5 business days',
   true, true, 8, NOW() - INTERVAL '20 days'),
  
  -- Another video product (inactive draft)
  ('cccccccc-0009-0009-0009-cccccccccccc', '33333333-3333-3333-3333-333333333333',
   'Advanced Video Editing Course (Coming Soon)', 'Professional techniques for cinematic video production',
   3999, 'video', null, 'https://example.com/thumbnails/editing-course-thumb.jpg',
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
   'https://example.com/thumbnails/samples-thumb.jpg', '2GB of samples, WAV format',
   'ZIP download sent immediately', true, false, 1, NOW() - INTERVAL '40 days'),
  
  ('cccccccc-1002-1002-1002-cccccccccccc', '44444444-4444-4444-4444-444444444444',
   'YouTube SEO Checklist', '25-point checklist for optimizing videos and channel for discovery',
   599, 'pdf', 'https://example.com/downloads/youtube-seo.pdf',
   'https://example.com/thumbnails/youtube-seo-thumb.jpg', 'Printable PDF checklist',
   'PDF sent immediately', true, false, 2, NOW() - INTERVAL '25 days'),
  
  ('cccccccc-1003-1003-1003-cccccccccccc', '44444444-4444-4444-4444-444444444444',
   'Beat Tape (10 Exclusive Beats)', 'Original hip-hop and R&B instrumental beats exclusive on this store',
   2499, 'audio', 'https://example.com/downloads/beat-tape-10.zip',
   'https://example.com/thumbnails/beats-thumb.jpg', 'MP3 + WAV, commercial license included',
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

-- Output summary
SELECT 'Seed data inserted successfully!' as message;
SELECT '✅ Created 2 test users (password: sample123)' as info_1;
SELECT '✅ Created 2 creators with settings' as info_2;
SELECT '✅ Created 5 sample messages' as info_3;
SELECT '✅ Created 5 sample payments' as info_4;
SELECT '✅ Created availability slots for Sarah' as info_5;
SELECT '✅ Created 1 sample call booking' as info_6;
SELECT '✅ Created 12 sample links (7 for Sarah, 5 for Mike)' as info_7;
SELECT '✅ Created 40 sample link clicks' as info_8;
SELECT '✅ Created 12 sample shop items (9 for Sarah, 3 for Mike)' as info_9;
SELECT '✅ Created 5 sample shop orders (3 completed, 1 pending, 1 completed)' as info_10;
SELECT '' as separator;
SELECT 'Test Users:' as users_header;
SELECT '- creator@example.com (Sarah Johnson) - Messages: $10, Calls: $50/30min, Shop: ENABLED' as user_1;
SELECT '- creator2@example.com (Mike Chen) - Messages: $5, Calls: disabled, Shop: ENABLED' as user_2;
SELECT '' as separator;
SELECT 'Shop Products Available:' as shop_header;
SELECT '  Sarah''s Shop (9 items):' as sarah_shop;
SELECT '    - 2 Videos (workout, reel templates)' as sarah_1;
SELECT '    - 2 Audio (meditation, podcast guide)' as sarah_2;
SELECT '    - 2 PDFs (social media guide, email templates)' as sarah_3;
SELECT '    - 1 Image pack (100 stock photos)' as sarah_4;
SELECT '    - 1 Shoutout request (personalized video)' as sarah_5;
SELECT '    - 1 Draft video (coming soon)' as sarah_6;
SELECT '  Mike''s Shop (3 items):' as mike_shop;
SELECT '    - 1 Audio (sample pack)' as mike_1;
SELECT '    - 1 PDF (YouTube SEO checklist)' as mike_2;
SELECT '    - 1 Audio (beat tape)' as mike_3;
SELECT '' as separator;
SELECT '2. Connect Stripe via Settings → Payments to enable checkout' as step_2;
SELECT '3. Update the environment variables with your Stripe keys' as step_3;
