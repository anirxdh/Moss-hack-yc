import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public routes: the marketing landing page and Clerk's own auth screens.
// Everything else — /upload, /call, /return, and all /api/* routes — requires
// an authenticated session. This is the single auth gate for the AI-CPA flow:
// the Clerk userId it establishes is the identity threaded through S3 keys,
// document ingestion, and the agent's per-user retrieval filter.
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    // Use redirectToSignIn (not auth.protect) so signed-out users on a page route
    // get a 307 to /sign-in with a return URL — auth.protect() falls back to a bare
    // 404 here, which reads as a broken link rather than "please sign in".
    const { userId, redirectToSignIn } = await auth();
    if (!userId) {
      return redirectToSignIn();
    }
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Clerk auto-proxy path (keyless/handshake) — must pass through middleware
    '/__clerk/:path*',
  ],
};
