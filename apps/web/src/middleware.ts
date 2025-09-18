import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

const isOnboardingRoute = createRouteMatcher(['/onboarding'])
const isPublicRoute = createRouteMatcher(['/public-route-example'])
const isDashboardRoute = createRouteMatcher(['/dashboard'])

interface SessionMetadata {
  onboardingComplete?: boolean;
  role?: 'manufacturer' | 'distributor' | 'retailer';
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { isAuthenticated, sessionClaims, redirectToSignIn } = await auth()
  const metadata = sessionClaims?.metadata as SessionMetadata;

  // If the user isn't signed in and the route is private, redirect to sign-in
  if (!isAuthenticated && !isPublicRoute(req)) {
    return redirectToSignIn({ returnBackUrl: req.url })
  }

  // If user is authenticated, check their onboarding status
  if (isAuthenticated) {
    const hasValidRole = metadata?.role && ['manufacturer', 'distributor', 'retailer'].includes(metadata.role)
    const isOnboardingComplete = metadata?.onboardingComplete === true

     if (req.nextUrl.pathname === '/') {
    if (isOnboardingComplete && hasValidRole) {
      console.log('Redirecting from root to dashboard')
      const dashboardUrl = new URL('/dashboard', req.url)
      return NextResponse.redirect(dashboardUrl)
    } else {
      console.log('Redirecting from root to onboarding')
      const onboardingUrl = new URL('/onboarding', req.url)
      return NextResponse.redirect(onboardingUrl)
    }
  }

    // If user is on onboarding route and already completed onboarding with valid role, redirect to dashboard
    if (isOnboardingRoute(req) && isOnboardingComplete && hasValidRole) {
      const dashboardUrl = new URL('/dashboard', req.url)
      return NextResponse.redirect(dashboardUrl)
    }

    // If user is visiting onboarding route and hasn't completed onboarding, allow access
    if (isOnboardingRoute(req)) {
      return NextResponse.next()
    }

    // If user hasn't completed onboarding or doesn't have a valid role, redirect to onboarding
    if (!isOnboardingComplete || !hasValidRole) {
      const onboardingUrl = new URL('/onboarding', req.url)
      return NextResponse.redirect(onboardingUrl)
    }

    // If user is authenticated and onboarding is complete with valid role, allow access to protected routes
    return NextResponse.next()
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}