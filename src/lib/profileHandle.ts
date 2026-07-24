export const PROFILE_HANDLE_PATTERN_SOURCE = '[a-z0-9][a-z0-9-]{2,30}';
export const PROFILE_HANDLE_MAX_LENGTH = 31;
export const PROFILE_HANDLE_HELP = '3–31 lowercase letters, numbers, or hyphens.';

const profileHandlePattern = new RegExp(`^${PROFILE_HANDLE_PATTERN_SOURCE}$`);

export function isProfileHandle(value: string | null): value is string {
  return Boolean(value && profileHandlePattern.test(value));
}
