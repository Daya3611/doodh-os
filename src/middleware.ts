import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value;
  const role = request.cookies.get('user-role')?.value;
  const { pathname } = request.nextUrl;

  const isPublicPage = pathname === '/login' || pathname === '/register' || pathname === '/';

  // If not authenticated and trying to access a protected page, redirect to login
  if (!session) {
    if (!isPublicPage) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // If authenticated and trying to access a public page, redirect to respective landing dashboard
  if (isPublicPage) {
    if (role === 'MASTER_ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    } else if (role === 'STAFF') {
      return NextResponse.redirect(new URL('/collections/new', request.url));
    } else {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Protect /admin routes from non-admins
  if (pathname.startsWith('/admin') && role !== 'MASTER_ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Protect /dashboard and other non-admin routes from MASTER_ADMIN
  if (!pathname.startsWith('/admin') && role === 'MASTER_ADMIN' && !isPublicPage) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/dashboard/:path*',
    '/farmers/:path*',
    '/collections/:path*',
    '/admin/:path*'
  ],
};
