import { clerkMiddleware, createRouteMatcher } from '@clerk/astro/server'
import { defineMiddleware, sequence } from 'astro:middleware'
import { env } from 'cloudflare:workers'
import {
  parseLocationCookie,
  validateLocationAccess,
  getDefaultLocation,
  setLocationCookie,
  clearLocationCookie,
} from './lib/auth/location'

const isPublicRoute = createRouteMatcher([
  '/',
  '/compare',
  '/welcome',
  '/welcome/pending',
  '/onboarding',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
  '/invite/(.*)',
])

const isLocationPickerRoute = createRouteMatcher(['/locations/select'])

const clerkAuth = clerkMiddleware((auth, context) => {
  if (!isPublicRoute(context.request) && !auth().isAuthenticated) {
    return auth().redirectToSignIn()
  }
})

const locationAuth = defineMiddleware(async (context, next) => {
  context.locals.location = null

  const authResult = context.locals.auth()

  if (!authResult.userId || isPublicRoute(context.request)) {
    return next()
  }

  if (isLocationPickerRoute(context.request)) {
    return next()
  }

  const { DB } = env
  const cookieHeader = context.request.headers.get('cookie')
  const locationId = parseLocationCookie(cookieHeader)

  if (locationId) {
    const role = await validateLocationAccess(DB, authResult.userId, locationId)
    if (role) {
      context.locals.location = { locationId, role }
      return next()
    }
    const response = context.redirect('/locations/select')
    response.headers.set('Set-Cookie', clearLocationCookie())
    return response
  }

  const defaultLocation = await getDefaultLocation(DB, authResult.userId)

  if (!defaultLocation) {
    return context.redirect('/onboarding')
  }

  const response = context.redirect(context.request.url)
  response.headers.set('Set-Cookie', setLocationCookie(defaultLocation.locationId))
  return response
})

export const onRequest = sequence(clerkAuth, locationAuth)
