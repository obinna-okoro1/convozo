/**
 * Availability Manager Component
 * Allows creators to set their weekly call availability schedule
 * Used inside the dashboard as a dedicated view tab
 */

import { Component, OnInit, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreatorService } from '../../services/creator.service';
import { AvailabilitySlot, DayOfWeek } from '../../../../core/models';

interface DaySchedule {
  day: DayOfWeek;
  label: string;
  shortLabel: string;
  enabled: boolean;
  slots: TimeSlot[];
}

interface TimeSlot {
  id?: string;
  startTime: string;
  endTime: string;
}

const DAY_LABELS: { day: DayOfWeek; label: string; shortLabel: string }[] = [
  { day: 0, label: 'Sunday', shortLabel: 'Sun' },
  { day: 1, label: 'Monday', shortLabel: 'Mon' },
  { day: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { day: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { day: 4, label: 'Thursday', shortLabel: 'Thu' },
  { day: 5, label: 'Friday', shortLabel: 'Fri' },
  { day: 6, label: 'Saturday', shortLabel: 'Sat' },
];

const TIME_OPTIONS: string[] = [];
// Generate time options in 30-minute intervals from 00:00 to 23:30
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }
}

@Component({
  selector: 'app-availability-manager',
  imports: [CommonModule, FormsModule],
  templateUrl: './availability-manager.component.html',
  styleUrls: ['./availability-manager.component.css']
})
export class AvailabilityManagerComponent implements OnInit {
  @Input({ required: true }) creatorId!: string;

  protected readonly loading = signal<boolean>(true);
  protected readonly saving = signal<boolean>(false);
  protected readonly saved = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly schedule = signal<DaySchedule[]>([]);

  protected readonly timeOptions = TIME_OPTIONS;

  /**
   * Extract string value from a select/input event
   */
  protected inputValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected readonly totalSlots = computed(() =>
    this.schedule().reduce((sum, day) => sum + (day.enabled ? day.slots.length : 0), 0)
  );

  protected readonly activeDays = computed(() =>
    this.schedule().filter(d => d.enabled).length
  );

  constructor(private readonly creatorService: CreatorService) {}

  async ngOnInit(): Promise<void> {
    await this.loadAvailability();
  }

  /**
   * Load existing availability from DB
   */
  private async loadAvailability(): Promise<void> {
    try {
      const { data, error } = await this.creatorService.getAvailabilitySlots(this.creatorId);

      if (error) {
        this.error.set('Failed to load availability');
        this.initEmptySchedule();
        return;
      }

      this.buildScheduleFromSlots(data || []);
    } catch (err) {
      this.error.set('Failed to load availability');
      this.initEmptySchedule();
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Build schedule from DB availability slots
   */
  private buildScheduleFromSlots(slots: AvailabilitySlot[]): void {
    const schedule: DaySchedule[] = DAY_LABELS.map(({ day, label, shortLabel }) => {
      const daySlots = slots
        .filter(s => s.day_of_week === day && s.is_active)
        .map(s => ({
          id: s.id,
          startTime: s.start_time.substring(0, 5), // Ensure HH:MM format
          endTime: s.end_time.substring(0, 5),
        }));

      return {
        day,
        label,
        shortLabel,
        enabled: daySlots.length > 0,
        slots: daySlots.length > 0 ? daySlots : [{ startTime: '09:00', endTime: '17:00' }],
      };
    });

    this.schedule.set(schedule);
  }

  /**
   * Initialize empty schedule
   */
  private initEmptySchedule(): void {
    const schedule: DaySchedule[] = DAY_LABELS.map(({ day, label, shortLabel }) => ({
      day,
      label,
      shortLabel,
      enabled: false,
      slots: [{ startTime: '09:00', endTime: '17:00' }],
    }));
    this.schedule.set(schedule);
  }

  /**
   * Toggle a day on/off
   */
  protected toggleDay(dayIndex: number): void {
    const current = this.schedule();
    const updated = [...current];
    updated[dayIndex] = {
      ...updated[dayIndex],
      enabled: !updated[dayIndex].enabled,
    };
    this.schedule.set(updated);
    this.saved.set(false);
  }

  /**
   * Add a time slot to a day
   */
  protected addSlot(dayIndex: number): void {
    const current = this.schedule();
    const updated = [...current];
    const day = { ...updated[dayIndex] };
    const lastSlot = day.slots[day.slots.length - 1];

    // Default new slot starts 1 hour after last slot ends
    const lastEnd = lastSlot ? lastSlot.endTime : '09:00';
    const endHour = parseInt(lastEnd.split(':')[0]) + 2;
    const newEnd = endHour < 24 ? `${endHour.toString().padStart(2, '0')}:00` : '23:30';

    day.slots = [...day.slots, { startTime: lastEnd, endTime: newEnd }];
    updated[dayIndex] = day;
    this.schedule.set(updated);
    this.saved.set(false);
  }

  /**
   * Remove a time slot from a day
   */
  protected removeSlot(dayIndex: number, slotIndex: number): void {
    const current = this.schedule();
    const updated = [...current];
    const day = { ...updated[dayIndex] };
    day.slots = day.slots.filter((_, i) => i !== slotIndex);

    // If no slots left, keep one default
    if (day.slots.length === 0) {
      day.slots = [{ startTime: '09:00', endTime: '17:00' }];
    }

    updated[dayIndex] = day;
    this.schedule.set(updated);
    this.saved.set(false);
  }

  /**
   * Update a slot's start time
   */
  protected updateStartTime(dayIndex: number, slotIndex: number, value: string): void {
    const current = this.schedule();
    const updated = [...current];
    const day = { ...updated[dayIndex] };
    const slots = [...day.slots];
    slots[slotIndex] = { ...slots[slotIndex], startTime: value };
    day.slots = slots;
    updated[dayIndex] = day;
    this.schedule.set(updated);
    this.saved.set(false);
  }

  /**
   * Update a slot's end time
   */
  protected updateEndTime(dayIndex: number, slotIndex: number, value: string): void {
    const current = this.schedule();
    const updated = [...current];
    const day = { ...updated[dayIndex] };
    const slots = [...day.slots];
    slots[slotIndex] = { ...slots[slotIndex], endTime: value };
    day.slots = slots;
    updated[dayIndex] = day;
    this.schedule.set(updated);
    this.saved.set(false);
  }

  /**
   * Copy a day's schedule to all weekdays (Mon-Fri)
   */
  protected copyToWeekdays(sourceDayIndex: number): void {
    const current = this.schedule();
    const source = current[sourceDayIndex];
    const updated = current.map((day, i) => {
      // Apply to Mon(1) through Fri(5), skip source
      if (day.day >= 1 && day.day <= 5 && i !== sourceDayIndex) {
        return {
          ...day,
          enabled: source.enabled,
          slots: source.slots.map(s => ({ ...s, id: undefined })),
        };
      }
      return day;
    });
    this.schedule.set(updated);
    this.saved.set(false);
  }

  /**
   * Save availability to database
   */
  protected async saveAvailability(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.saved.set(false);

    try {
      // Build slots array from schedule
      const slots = this.schedule()
        .filter(day => day.enabled)
        .flatMap(day =>
          day.slots.map(slot => ({
            creator_id: this.creatorId,
            day_of_week: day.day,
            start_time: slot.startTime,
            end_time: slot.endTime,
            is_active: true,
          }))
        );

      const result = await this.creatorService.saveAvailabilitySlots(this.creatorId, slots);

      if (result.success) {
        this.saved.set(true);
        // Reload to get fresh IDs
        await this.loadAvailability();
        // Show saved state after reload
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 3000);
      } else {
        this.error.set(result.error || 'Failed to save availability');
      }
    } catch (err) {
      this.error.set('Failed to save availability');
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Format time for display (24h → 12h)
   */
  protected formatTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
}
