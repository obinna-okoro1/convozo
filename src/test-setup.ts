/**
 * Vitest setup: initialises the Angular TestBed once per worker.
 * The app is zoneless, so no zone.js imports are needed.
 */

import '@angular/compiler';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

getTestBed()
  .initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
