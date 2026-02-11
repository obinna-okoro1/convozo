/**
 * Application-wide constants
 */

export const APP_CONSTANTS = {
  MESSAGE_MAX_LENGTH: 1000,
  PRICE_MULTIPLIER: 100, // Convert dollars to cents
  DEFAULT_RESPONSE_EXPECTATION: 'I typically respond within 24-48 hours.',
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

export const ROUTES = {
  HOME: '/home',
  AUTH: {
    LOGIN: '/auth/login',
    CALLBACK: '/auth/callback',
  },
  CREATOR: {
    ONBOARDING: '/creator/onboarding',
    DASHBOARD: '/creator/dashboard',
  },
  SUCCESS: '/success',
} as const;

export const ERROR_MESSAGES = {
  AUTH: {
    NOT_AUTHENTICATED: 'Not authenticated',
    EMAIL_REQUIRED: 'Please enter your email',
    EMAIL_INVALID: 'Please enter a valid email',
    INVALID_EMAIL: 'Please enter a valid email',
    LOGIN_FAILED: 'Failed to send magic link',
  },
  MESSAGE: {
    NAME_REQUIRED: 'Please enter your name',
    EMAIL_REQUIRED: 'Please enter a valid email',
    CONTENT_REQUIRED: 'Please enter your message',
    CONTENT_TOO_LONG: 'Message is too long (max 1000 characters)',
  },
  GENERAL: {
    FAILED_TO_LOAD: 'Failed to load data',
    UNKNOWN_ERROR: 'An error occurred',
  },
  PAYMENT: {
    NOT_INITIALIZED: 'Payment system not initialized',
    FAILED_TO_PROCESS: 'Failed to process payment',
  },
} as const;
