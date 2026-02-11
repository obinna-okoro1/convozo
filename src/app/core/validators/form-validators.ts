/**
 * Form validation utilities
 */

import { APP_CONSTANTS } from '../constants';

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
}
