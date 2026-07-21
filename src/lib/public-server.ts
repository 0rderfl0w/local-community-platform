type PublicRecordLookupOptions = {
  baseUrl?: string;
  anonKey?: string;
  fetcher?: typeof fetch;
  onError?: (message: string, error: unknown) => void;
};

export type PublicRecordLookup<T> = {
  available: boolean;
  data: T | null;
};

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const SAFE_SELECT = /^[a-z0-9_, ]+$/;

function assertSafeLookup(table: string, column: string, select: string) {
  if (!SAFE_IDENTIFIER.test(table) || !SAFE_IDENTIFIER.test(column) || !SAFE_SELECT.test(select)) {
    throw new Error('Invalid public record lookup.');
  }
}

async function publicRecordLookupWithConfig<T>(
  table: string,
  column: string,
  value: string,
  select: string,
  {
    baseUrl,
    anonKey,
    fetcher = fetch,
    onError = (message, error) => console.error(message, error)
  }: PublicRecordLookupOptions
): Promise<PublicRecordLookup<T>> {
  if (!baseUrl || !anonKey || baseUrl.includes('example.supabase.co')) {
    return { available: false, data: null };
  }
  assertSafeLookup(table, column, select);

  const url = new URL(`/rest/v1/${table}`, baseUrl);
  url.searchParams.set('select', select);
  url.searchParams.set(column, `eq.${value}`);
  url.searchParams.set('limit', '1');

  try {
    const response = await fetcher(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      }
    });
    if (!response.ok) return { available: false, data: null };
    const rows = await response.json();
    return {
      available: true,
      data: Array.isArray(rows) && rows.length > 0 ? rows[0] as T : null
    };
  } catch (error) {
    onError('[public-record-lookup]', error);
    return { available: false, data: null };
  }
}

export async function publicRecordLookup<T>(
  table: string,
  column: string,
  value: string,
  select: string
): Promise<PublicRecordLookup<T>> {
  return publicRecordLookupWithConfig<T>(table, column, value, select, {
    baseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
    anonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  });
}

export async function publicRecordExistsWithConfig(
  table: string,
  column: string,
  value: string,
  options: PublicRecordLookupOptions
): Promise<boolean | null> {
  const result = await publicRecordLookupWithConfig<Record<string, unknown>>(
    table,
    column,
    value,
    column,
    options
  );
  if (!result.available) return null;
  return Boolean(result.data);
}

export async function publicRecordExists(
  table: string,
  column: string,
  value: string
): Promise<boolean | null> {
  return publicRecordExistsWithConfig(table, column, value, {
    baseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
    anonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  });
}
