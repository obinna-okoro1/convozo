import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ScriptLoaderService {
  private readonly document = inject(DOCUMENT);

  // Stores the promise per URL — late callers get the same promise, no duplicate network request.
  private readonly registry = new Map<string, Promise<void>>();

  load(src: string): Promise<void> {
    const cached = this.registry.get(src);
    if (cached) return cached;

    const promise = new Promise<void>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = src;
      // Dynamically injected scripts are already treated as async by browsers.
      // Setting async=true makes the intent explicit and matches the spec.
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error(`[ScriptLoader] Failed to load script: ${src}`));
      this.document.head.appendChild(script);
    });

    this.registry.set(src, promise);
    return promise;
  }

  isRequested(src: string): boolean {
    return this.registry.has(src);
  }
}
