/**
 * Form validation utilities
 */

import { APP_CONSTANTS } from '../constants';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class FormValidators {
  /**
   * Validates email format
   */
  public static isValidEmail(email: string): boolean {
    return APP_CONSTANTS.EMAIL_REGEX.test(email);
  }

  /**
   * Validates message content length
   */
  public static isValidMessageLength(content: string): boolean {
    return content.length > 0 && content.length <= APP_CONSTANTS.MESSAGE_MAX_LENGTH;
  }

  /**
   * Validates that a string is not empty after trimming
   */
  public static isNotEmpty(value: string): boolean {
    return value.trim().length > 0;
  }

  /**
   * Generates a slug from a name
   */
  public static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Sanitizes a slug value as the user types (strips invalid chars, forces lowercase).
   * Valid chars: lowercase letters, digits, hyphens, underscores.
   */
  public static sanitizeSlug(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/-{2,}/g, '-')
      .replace(/^[-_]/, '');
  }

  /**
   * Validates that a slug matches ^[a-z0-9_-]{3,30}$
   * Minimum 3 characters, maximum 30, lowercase alphanumeric + hyphens + underscores.
   * Must not start with a hyphen or underscore.
   */
  public static isValidSlug(slug: string): boolean {
    return /^[a-z0-9][a-z0-9_-]{2,29}$/.test(slug);
  }
}
