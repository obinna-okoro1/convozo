-- Simplify pricing structure and add call booking system

-- 1. Remove tiered pricing from creator_settings
ALTER TABLE public.creator_settings DROP COLUMN IF EXISTS has_tiered_pricing;
ALTER TABLE public.creator_settings DROP COLUMN IF EXISTS fan_price;
ALTER TABLE public.creator_settings DROP COLUMN IF EXISTS business_price;

-- Rename single_price to message_price for clarity
ALTER TABLE public.creator_settings RENAME COLUMN single_price TO message_price;

-- 2. Add call pricing to creator_settings
ALTER TABLE public.creator_settings ADD COLUMN IF NOT EXISTS call_price INTEGER; -- in cents
ALTER TABLE public.creator_settings ADD COLUMN IF NOT EXISTS call_duration INTEGER DEFAULT 30; -- in minutes
ALTER TABLE public.creator_settings ADD COLUMN IF NOT EXISTS calls_enabled BOOLEAN DEFAULT false;

-- 3. Update message_type to only allow 'message'
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check 
  CHECK (message_type IN ('message', 'call'));

-- 4. Create availability slots table
CREATE TABLE IF NOT EXISTS public.availability_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create call bookings table
CREATE TABLE IF NOT EXISTS public.call_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  booker_name TEXT NOT NULL,
  booker_email TEXT NOT NULL,
  booker_instagram TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL, -- in minutes
  amount_paid INTEGER NOT NULL, -- in cents
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  call_notes TEXT,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create indexes for call-related tables
CREATE INDEX IF NOT EXISTS idx_availability_creator_id ON public.availability_slots(creator_id);
CREATE INDEX IF NOT EXISTS idx_availability_day ON public.availability_slots(day_of_week);
CREATE INDEX IF NOT EXISTS idx_bookings_creator_id ON public.call_bookings(creator_id);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_at ON public.call_bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.call_bookings(status);

-- 7. Add updated_at triggers for new tables
CREATE TRIGGER update_availability_slots_updated_at
  BEFORE UPDATE ON public.availability_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_bookings_updated_at
  BEFORE UPDATE ON public.call_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Update existing data to use 'message' type instead of 'fan', 'business', 'single'
UPDATE public.messages 
SET message_type = 'message' 
WHERE message_type IN ('fan', 'business', 'single');
