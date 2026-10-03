const DEFAULT_REDIRECT = '/groups';

// Return the in-app path to go to after signing in. The redirect comes from
// the URL, so only accept paths within this app: anything that isn't a single
// leading "/" path (e.g. "//evil.example", "https://...", "/\evil") falls
// back to the groups list.
export function getSafeRedirect(redirect: string | null | undefined): string {
  if (!redirect) return DEFAULT_REDIRECT;
  if (!redirect.startsWith('/') || redirect.startsWith('//') || redirect.includes('\\')) {
    return DEFAULT_REDIRECT;
  }
  return redirect;
}
