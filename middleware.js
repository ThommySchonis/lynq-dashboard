import { NextResponse } from 'next/server'

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // Haal alle Supabase auth cookies op
  const cookies = request.cookies
  const projectId = 'cvrzvhnsltjubmfkcxql'

  // Check voor Supabase session cookie (nieuwe en oude formaten)
  const hasSession =
    cookies.has(`sb-${projectId}-auth-token`) ||
    cookies.has('sb-access-token') ||
    cookies.has(`sb-${projectId}-auth-token.0`) ||
    [...cookies.getAll()].some(c => c.name.startsWith('sb-') && c.name.includes('auth'))

  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard.html'],
}
