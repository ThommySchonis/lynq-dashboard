import { NextResponse } from 'next/server'

const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/webhooks/',
  '/api/whop/webhook',
]

function isPublicApiPath(pathname) {
  return PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export function proxy(request) {
  const { pathname } = request.nextUrl

  if (request.method === 'OPTIONS' || isPublicApiPath(pathname)) {
    return NextResponse.next()
  }

  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
