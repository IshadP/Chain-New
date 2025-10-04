import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

// 1. Define all route matchers
// Public routes are accessible to everyone, logged in or not (initially).
const isPublicRoute = createRouteMatcher(['/', '/batch/(.*)', '/sign-in(.*)', '/sign-up(.*)']);
// The onboarding route needs to be identified to handle special redirection logic.
const isOnboardingRoute = createRouteMatcher(['/onboarding']);

// Define session metadata type for clarity and type safety.
interface SessionMetadata {
  onboardingComplete?: boolean;
  role?: 'manufacturer' | 'distributor' | 'retailer';
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, sessionClaims } = await auth();
  const metadata = sessionClaims?.metadata as SessionMetadata;

  // --- Logic for Authenticated Users ---
  if (userId) {
    const onboardingComplete = metadata?.onboardingComplete === true;
    const hasValidRole = metadata?.role && ['manufacturer', 'distributor', 'retailer'].includes(metadata.role);
    const isFullyOnboarded = onboardingComplete && hasValidRole;

    // Case 1: User is on the onboarding page.
    if (isOnboardingRoute(req)) {
      // If they are already fully onboarded, they don't need to be here. Redirect to dashboard.
      if (isFullyOnboarded) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
      // Otherwise, they are in the right place. Allow access.
      return NextResponse.next();
    }

    // Case 2: User is NOT fully onboarded and is trying to access any other page.
    // Force them to the onboarding page to complete their profile.
    if (!isFullyOnboarded) {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
    
    // Case 3: User IS fully onboarded and lands on the public homepage.
    // Redirect them directly to their dashboard.
    if (isFullyOnboarded && req.nextUrl.pathname === '/') {
       return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // If none of the above, the user is authenticated, fully onboarded, 
    // and accessing an allowed page (like /dashboard or /batch/...). Let them proceed.
    return NextResponse.next();
  }

  // --- Logic for Unauthenticated Users ---
  // If an unauthenticated user tries to access a route that is NOT public, protect it.
  // Clerk will automatically redirect them to the sign-in page.
  if (!isPublicRoute(req)) {
    // FIX: await auth() before calling protect()
    await auth.protect();
  }

  // If the route is public, allow access for the unauthenticated user.
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};