export type UpstreamError = Error & {
  status?: number;
  code?: string;
};

export const maskedSigninMessage =
  'Request received. If that address belongs to an active member, check the inbox for a sign-in link. If nothing arrives, wait a few minutes before trying again.';

function stringField(body: unknown, key: string) {
  if (!body || typeof body !== 'object' || !(key in body)) return '';
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function createUpstreamError(body: unknown, status: number): UpstreamError {
  const message =
    stringField(body, 'message') ||
    stringField(body, 'msg') ||
    stringField(body, 'error_description') ||
    stringField(body, 'error') ||
    `Request failed: ${status}`;
  const error = new Error(message) as UpstreamError;
  error.status = status;
  const code = stringField(body, 'code') || stringField(body, 'error_code');
  if (code) error.code = code;
  return error;
}

export function publicInviteDeliveryError(caught: unknown) {
  const error = caught as UpstreamError;
  const status = error?.status;
  const code = error?.code || '';
  const message = error instanceof Error ? error.message : '';

  if (status === 429 || /rate_limit|wait|too many|rate/i.test(`${code} ${message}`)) {
    return { status: 429, error: 'Please wait before requesting another sign-in link.' };
  }
  if (/invalid email/i.test(message)) {
    return { status: 400, error: 'Enter a valid email address.' };
  }
  if (/invalid|active|expired|exhausted|limit|revoked|suspended/i.test(message)) {
    return { status: 403, error: 'This invite cannot be used. Ask a member or organizer for a current private link.' };
  }
  return { status: 500, error: 'The sign-in link could not be sent. Please try again.' };
}
