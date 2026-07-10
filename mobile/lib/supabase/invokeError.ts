import { FunctionsHttpError } from '@supabase/supabase-js';

// Edge Functions in this app return { error: string } with a non-2xx status on failure.
// supabase-js surfaces that as a FunctionsHttpError whose body must be read separately.
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error as string;
    } catch {
      // ignore body parse failure, fall through to fallback
    }
  }
  return fallback;
}
