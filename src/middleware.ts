import { clerkMiddleware, createRouteMatcher } from '@clerk/astro/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/welcome',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
  '/invite/(.*)',
])

export const onRequest = clerkMiddleware((auth, context) => {
  if (!isPublicRoute(context.request) && !auth().isAuthenticated) {
    return auth().redirectToSignIn()
  }
})
