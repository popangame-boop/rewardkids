import { createBrowserClient } from "@supabase/ssr";

// We use 'any' for the Database generic in the browser client to avoid
// TypeScript issues in Client Components. Type safety is enforced via
// manual type annotations in each component.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient() {
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
