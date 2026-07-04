'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';
import { useAuthStore, UserProfile } from '@/store/useAuthStore';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setProfile, setLoading, profile } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Fetch user profile from Firestore
        // Depending on role, the profile might be in 'users' or 'centers/X/staff/Y'
        // Let's assume a global 'users' collection maps UID to roles and center assignments
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            setProfile(data);
          } else {
            console.error("User profile not found in database.");
            setProfile(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setProfile, setLoading]);

  useEffect(() => {
    // Simple route protection (Middleware is preferred, but doing client-side as well)
    const publicPaths = ['/login', '/register', '/'];
    if (!useAuthStore.getState().isLoading) {
      const isAuth = !!useAuthStore.getState().user;
      if (!isAuth && !publicPaths.includes(pathname)) {
        router.push('/login');
      } else if (isAuth && publicPaths.includes(pathname)) {
        router.push('/dashboard');
      }
    }
  }, [pathname, profile, router]);

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
