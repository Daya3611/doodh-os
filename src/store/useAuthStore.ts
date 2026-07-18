import { create } from 'zustand';
import { User } from 'firebase/auth';

export type UserRole = 'MASTER_ADMIN' | 'OWNER' | 'STAFF';

export interface UserProfile {
  uid?: string;
  email: string;
  role: UserRole;
  centerId?: string;
  name: string;
  active?: boolean;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (isLoading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  signOut: () => set({ user: null, profile: null }),
}));
