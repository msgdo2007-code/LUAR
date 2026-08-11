import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";

type PendingCookie = { name: string; value: string; options: CookieOptions };

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = [`default-src 'self'`, `base-uri 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`, `style-src 'self' 'unsafe-inline' https://luar-admin.vercel.app`, `img-src 'self' data:`, `connect-src 'self' https://thdocebzzvxrwaefzufm.supabase.co`, `font-src 'self'`, `upgrade-insecure-requests`].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const pendingCookies: PendingCookie[] = [];
  const secure = (response: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" }));
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };
  let response = secure(NextResponse.next({ request: { headers: requestHeaders } }));
  const env = getSupabaseEnv();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        pendingCookies.push(...values);
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = secure(NextResponse.next({ request: { headers: requestHeaders } }));
      },
    },
  });
  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/admin/login" || pathname === "/login";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return isLogin ? response : secure(NextResponse.redirect(new URL("/admin/login", request.url)));
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) {
    await supabase.auth.signOut();
    return secure(NextResponse.redirect(new URL("/admin/login?error=access", request.url)));
  }
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") return isLogin ? response : secure(NextResponse.redirect(new URL("/admin/login?step=mfa", request.url)));
  if (isLogin) return secure(NextResponse.redirect(new URL("/admin/dashboard", request.url)));
  return response;
}

export const config = { matcher: ["/admin/:path*", "/login/:path*", "/dashboard/:path*"] };
