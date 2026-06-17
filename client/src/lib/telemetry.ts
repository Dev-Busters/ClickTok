import posthog from 'posthog-js';

// Safe no-op wrapper — only fires when posthog was initialized (VITE_POSTHOG_KEY set).
export function track(event: string, props?: Record<string, unknown>): void {
  if (!(posthog as unknown as Record<string, unknown>)['__loaded']) return;
  posthog.capture(event, props);
}
