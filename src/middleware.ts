import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // In Next.js App Router, Firebase Auth state is not available synchronously on the server edge.
  // We can rely on a session cookie or just client-side protection. 
  // Given we are strictly using client-side Firebase Auth right now, we can check for a custom cookie
  // or pass through and let the client-side AuthProvider handle the redirect to avoid flashing.
  // A robust way without Firebase Admin is to let the client handle it, OR set a cookie on login.

  const session = request.cookies.get('session');
  
  // For now, as a placeholder, if we implement session cookies we can do:
  // if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
  //   return NextResponse.redirect(new URL('/login', request.url));
  // }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/dashboard/:path*', '/farmers/:path*', '/collections/:path*'],
};
