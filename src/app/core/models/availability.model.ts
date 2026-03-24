/**
 * Availability domain models
 * Creator availability slots for call bookings.
 */

/** 0 = Sunday, 6 = Saturday */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface AvailabilitySlot {
  id: string;
  creator_id: string;
  day_of_week: DayOfWeek;
  start_time: string; // HH:MM format
  end_time: string;   // HH:MM format
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
