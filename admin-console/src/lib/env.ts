import "server-only";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().startsWith("https://"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(80).max(4096),
});

export function getSupabaseEnv() {
  return schema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
