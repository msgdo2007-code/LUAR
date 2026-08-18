import "server-only";
import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url().startsWith("https://"),
  SUPABASE_ANON_KEY: z.string().min(80).max(4096),
});

export function getSupabaseEnv() {
  return schema.parse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  });
}
