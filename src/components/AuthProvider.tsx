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
    let logoutTimer: NodeJS.Timeout;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Enforce 4-hour max session
        try {
          const idTokenResult = await firebaseUser.getIdTokenResult();
          const authTime = new Date(idTokenResult.authTime).getTime();
          const fourHours = 4 * 60 * 60 * 1000;
          const timeElapsed = Date.now() - authTime;
          
          if (timeElapsed >= fourHours) {
            console.warn("Session expired (4 hours). Signing out.");
            signOut(auth);
            return;
          } else {
            clearTimeout(logoutTimer);
            logoutTimer = setTimeout(() => {
              console.warn("Session expired (4 hours). Signing out.");
              signOut(auth);
            }, fourHours - timeElapsed);
          }
        } catch (e) {
          console.error("Error checking token time:", e);
        }

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
          } else {
            console.error("User profile not found in database.");
            setProfile(null);
            signOut(auth);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setProfile(null);
        }
      } else {
        clearTimeout(logoutTimer);
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      clearTimeout(logoutTimer);
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
          setTimeout(() => router.push(isAdmin ? '/admin/dashboard' : '/dashboard'), 0);
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
