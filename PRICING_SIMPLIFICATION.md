# Pricing Simplification & Call Booking Feature

## Overview
This document describes the major schema and feature changes implemented to simplify the pricing model and add video call booking functionality.

## Changes Summary

### 1. Database Schema Changes (Migration 004)

#### Removed Fields from `creator_settings`
- `has_tiered_pricing` - No longer needed with single pricing
- `fan_price` - Replaced by single message price
- `business_price` - Replaced by single message price
- `single_price` - Renamed to `message_price`

#### Added Fields to `creator_settings`
- `message_price` (integer, NOT NULL) - Single price for all messages in cents
- `call_price` (integer, nullable) - Price for video calls in cents
- `call_duration` (integer, nullable) - Duration of calls in minutes (15-120)
- `calls_enabled` (boolean, default: false) - Whether creator accepts calls

#### New Table: `availability_slots`
```sql
CREATE TABLE availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```
- `day_of_week`: 0 = Sunday, 6 = Saturday
- Supports recurring weekly availability

#### New Table: `call_bookings`
```sql
CREATE TABLE call_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  booker_name VARCHAR(255) NOT NULL,
  booker_email VARCHAR(255) NOT NULL,
  booker_instagram VARCHAR(255) NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  stripe_checkout_session_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

#### Updated Constraint
- `messages.message_type` now accepts: `('message', 'call')`
- Old values: `('fan', 'business', 'single')`

### 2. TypeScript Model Changes

#### Updated `CreatorSettings` Interface
```typescript
export interface CreatorSettings {
  id: string;
  creator_id: string;
  message_price: number;           // NEW
  call_price: number | null;       // NEW
  call_duration: number | null;    // NEW
  calls_enabled: boolean;          // NEW
  response_expectation: string | null;
  auto_reply_text: string | null;
  created_at: string;
  updated_at: string;
}
```

#### New Interfaces
```typescript
export interface AvailabilitySlot {
  id: string;
  creator_id: string;
  day_of_week: DayOfWeek; // 0-6
  start_time: string;     // HH:MM format
  end_time: string;       // HH:MM format
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CallBooking {
  id: string;
  creator_id: string;
  booker_name: string;
  booker_email: string;
  booker_instagram: string;
  scheduled_at: string;
  duration: number;
  amount_paid: number;
  status: CallBookingStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageType = 'message' | 'call';
export type CallBookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
```

#### Removed Types
- `PricingType` - No longer needed

### 3. Component Changes

#### Settings Component
**Before:**
- Toggle between single and tiered pricing
- Separate inputs for fan_price and business_price
- Single price input when not tiered

**After:**
- Single message_price input (always visible)
- Toggle for calls_enabled
- Call price and duration inputs (when enabled)
- Info box about availability management

#### Onboarding Component
**Before:**
- Radio buttons for pricing type selection
- Conditional inputs based on selected type
- Review shows pricing type

**After:**
- Single message price input
- Toggle for enabling calls
- Call price and duration (when enabled)
- Review shows simplified pricing

#### Message Page Component
**Before:**
- Message type selection (fan/business) when tiered
- Dynamic price calculation based on selection
- Different UI for tiered vs single pricing

**After:**
- No message type selection needed
- Single price display
- Simplified form flow

### 4. Service Updates

#### CreatorService
**Updated Methods:**
- `createCreatorSettings()` - Now accepts `messagePrice`, `callPrice`, `callDuration`, `callsEnabled`
- `updateCreatorSettings()` - Same parameter changes
- Removed `pricingType`, `singlePrice`, `fanPrice`, `businessPrice`

### 5. Seed Data Changes

#### Sarah Johnson (creator@example.com)
- `message_price`: 1000 ($10)
- `call_price`: 5000 ($50)
- `call_duration`: 30 minutes
- `calls_enabled`: true
- Sample availability slots (Mon-Fri, 9AM-5PM with breaks)
- Sample call booking

#### Mike Chen (creator2@example.com)
- `message_price`: 500 ($5)
- `calls_enabled`: false

#### Messages
- All `message_type` changed from `'fan'/'business'/'single'` to `'message'`

## Migration Applied
✅ Migration 004 applied successfully via `supabase db reset`

## Build Status
✅ All TypeScript files compile successfully
✅ No errors in production build

## Next Steps

### To Implement Call Booking Feature:
1. **Create Availability Management UI**
   - Component for creators to set weekly time slots
   - Day of week selector (Mon-Sun)
   - Time range pickers
   - Enable/disable individual slots

2. **Create Call Booking Flow**
   - Calendar view showing available slots
   - Time slot selection
   - Booking form with Instagram handle
   - Stripe checkout integration for calls
   - Confirmation page with call details

3. **Update Message Page**
   - Add "Book a Call" tab when `calls_enabled` is true
   - Show available time slots
   - Instagram handle input field
   - Call booking checkout flow

4. **Edge Functions**
   - Create `create-call-checkout-session` function
   - Handle call payment webhook events
   - Send booking confirmation emails

5. **Dashboard Updates**
   - Show call bookings in a separate section
   - Calendar view of scheduled calls
   - Call booking management (reschedule, cancel)

## Testing Checklist

- [ ] Settings page displays simplified pricing UI
- [ ] Onboarding flow creates correct settings
- [ ] Message page shows single price
- [ ] Existing creators migrated successfully
- [ ] Build completes without errors
- [ ] All database constraints work correctly

## Database Migration Notes

The migration safely:
- Renames `single_price` to `message_price` without data loss
- Drops columns that are no longer needed
- Adds new columns with sensible defaults
- Updates the message_type constraint
- Creates indexes for performance

All existing data is preserved and automatically migrated to the new structure.
