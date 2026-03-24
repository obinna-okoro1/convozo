/**
 * Availability Service
 * Handles all availability slot business logic:
 * loading, bulk-saving (replace), toggling, and deleting individual slots.
 *
 * Expects: creatorId (string), slotId (string)
 * Returns: typed SupabaseResponse<T> or { success, error } objects
 * Errors: all methods handle errors internally and never throw to callers
 */

import { Injectable } from '@angular/core';
import { AvailabilitySlot, SupabaseResponse } from '../../../core/models';
import { SupabaseService } from '../../../core/services/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class AvailabilityService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Load availability slots for a creator, ordered by day then start time
   */
  public async getAvailabilitySlots(
    creatorId: string,
  ): Promise<SupabaseResponse<AvailabilitySlot[]>> {
    const { data, error } = await this.supabaseService.client
      .from('availability_slots')
      .select('*')
      .eq('creator_id', creatorId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    return { data, error };
  }

  /**
   * Save availability slots for a creator.
   * Performs a full replace: deletes all existing slots then inserts new ones.
   */
  public async saveAvailabilitySlots(
    creatorId: string,
    slots: Omit<AvailabilitySlot, 'id' | 'created_at' | 'updated_at'>[],
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error: deleteError } = await this.supabaseService.client
        .from('availability_slots')
        .delete()
        .eq('creator_id', creatorId);

      if (deleteError) {
        throw deleteError;
      }

      if (slots.length > 0) {
        const { error: insertError } = await this.supabaseService.client
          .from('availability_slots')
          .insert(slots);

        if (insertError) {
          throw insertError;
        }
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save availability';
      return { success: false, error: message };
    }
  }

  /**
   * Add a single availability slot
   */
  public async addAvailabilitySlot(
    slot: Omit<AvailabilitySlot, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<SupabaseResponse<AvailabilitySlot>> {
    const { data, error } = await this.supabaseService.client
      .from('availability_slots')
      .insert(slot)
      .select()
      .single();

    return { data: data as AvailabilitySlot | null, error };
  }

  /**
   * Delete a single availability slot
   */
  public async deleteAvailabilitySlot(slotId: string): Promise<SupabaseResponse<void>> {
    const { error } = await this.supabaseService.client
      .from('availability_slots')
      .delete()
      .eq('id', slotId);

    return { data: undefined, error };
  }

  /**
   * Toggle a single availability slot's active state
   */
  public async toggleAvailabilitySlot(
    slotId: string,
    isActive: boolean,
  ): Promise<SupabaseResponse<AvailabilitySlot>> {
    const { data, error } = await this.supabaseService.client
      .from('availability_slots')
      .update({ is_active: isActive })
      .eq('id', slotId)
      .select()
      .single();

    return { data: data as AvailabilitySlot | null, error };
  }
}
