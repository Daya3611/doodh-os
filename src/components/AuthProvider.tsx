'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';
import { useAuthStore, UserProfile } from '@/store/useAuthStore';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setProfile, setLoading, profile, user, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          let data = userDoc.exists() ? (userDoc.data() as UserProfile) : null;
          
          // Hardcode override for Master Admin
          const masterAdminEmail = process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL;
          if (masterAdminEmail && firebaseUser.email === masterAdminEmail) {
            if (!data || data.role !== 'MASTER_ADMIN') {
              data = { email: firebaseUser.email, role: 'MASTER_ADMIN', name: 'Master Admin' };
              await setDoc(doc(db, 'users', firebaseUser.uid), data, { merge: true });
            }
          }

          if (data) {
            setProfile(data);
            // Set session cookies for middleware
            document.cookie = `session=true; path=/; max-age=31536000; SameSite=Lax`;
            document.cookie = `user-role=${data.role}; path=/; max-age=31536000; SameSite=Lax`;
          } else {
            console.error("User profile not found in database.");
            if (typeof window !== 'undefined' && navigator.onLine) {
              setProfile(null);
              document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
              document.cookie = "user-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
              signOut(auth);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          // Do not sign out if offline or error occurs to maintain offline session robustness
        }
      } else {
        setProfile(null);
        document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        document.cookie = "user-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [setUser, setProfile, setLoading]);

  useEffect(() => {
    // Simple route protection (Middleware is preferred, but doing client-side as well)
    const publicPaths = ['/login', '/register', '/'];
    if (!isLoading) {
      const isAuth = !!user;
      
      if (!isAuth && !publicPaths.includes(pathname)) {
        setTimeout(() => router.push('/login'), 0);
      } else if (isAuth) {
        const isAdmin = profile?.role === 'MASTER_ADMIN';
        
        // If logged in and on a public path, redirect to their respective dashboard
        if (publicPaths.includes(pathname)) {
          setTimeout(() => router.push(isAdmin ? '/admin/dashboard' : (profile?.role === 'STAFF' ? '/collections/new' : '/dashboard')), 0);
        }
        // Protect /admin routes from non-admins
        else if (pathname.startsWith('/admin') && !isAdmin) {
          setTimeout(() => router.push('/dashboard'), 0);
        }
        // Protect /dashboard and other routes from admins (optional, but requested separate portal)
        else if (!pathname.startsWith('/admin') && isAdmin && !publicPaths.includes(pathname)) {
          setTimeout(() => router.push('/admin/dashboard'), 0);
        }
      }
    }
  }, [pathname, user, profile, isLoading, router]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });
    }
  }, []);

  return <>{children}</>;
}
