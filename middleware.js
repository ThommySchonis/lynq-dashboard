import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // Alleen dashboard.html beschermen
  if (pathname === '/dashboard.html') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const authHeader = request.cookies.get('sb-access-token')?.value
      || request.cookies.get(`sb-${supabaseUrl?.split('//')[1]?.split('.')[0]}-auth-token`)?.value

    if (!authHeader) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard.html'],
}
