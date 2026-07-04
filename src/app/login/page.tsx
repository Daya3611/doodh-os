'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Droplets, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { UserProfile } from '@/store/useAuthStore';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = async (values: LoginForm) => {
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, values.email, values.password);
      
      // Fetch user profile to determine role-based redirect
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      const profile = userDoc.exists() ? (userDoc.data() as UserProfile) : null;

      toast.success('Welcome back!');

      // Role-based redirect
      if (profile?.role === 'STAFF') {
        router.push('/collections/new');
      } else {
        router.push('/dashboard');
      }
    } catch (error: any) {
      const msg =
        error.code === 'auth/invalid-credential' ? 'Invalid email or password' :
        error.code === 'auth/too-many-requests' ? 'Too many attempts. Try again later.' :
        error.message || 'Login failed';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) { toast.error('Enter your email first'); return; }
    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      toast.success('Password reset email sent!');
      setShowForgot(false);
    } catch {
      toast.error('Could not send reset email. Check the address.');
    } finally {
      setForgotLoading(false);
    }
  };

  const inputStyle = {
    background: '#F7F7F7',
    border: '1.5px solid #ECECEC',
    color: '#111111',
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F7F7F7' }}>
      {/* Left Brand Panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] p-12 flex-shrink-0"
        style={{ background: '#FF6B00' }}
      >
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="DoodhOS Logo" className="h-10 w-auto brightness-0 invert" />
        </div>
        <div>
          <h1 className="text-white text-4xl font-extrabold leading-tight mb-4">
            Manage your dairy center with precision
          </h1>
          <p className="text-white/70 text-[15px] leading-relaxed">
            Track milk collection, FAT/SNF rates, farmer payments, and daily reports — all in one place.
          </p>
        </div>
        <div className="flex gap-4">
          {['1,200+ Centers', '45,000+ Farmers', '₹2Cr+ Tracked'].map(stat => (
            <div key={stat} className="bg-white/15 rounded-xl px-3 py-2">
              <div className="text-white font-bold text-[13px]">{stat}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <img src="/logo.svg" alt="DoodhOS Logo" className="h-10 w-auto" />
          </div>

          <div className="mb-8">
            <h2 className="text-[28px] font-bold text-[#111111]">Sign in</h2>
            <p className="text-[14px] text-[#777777] mt-1">Access your milk collection center</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Email</label>
              <input
                {...register('email')}
                type="email"
                className="w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all"
                style={inputStyle}
                placeholder="owner@doodhos.com"
                onFocus={e => { e.currentTarget.style.borderColor = '#FF6B00'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#ECECEC'; }}
              />
              {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider">Password</label>
                <button type="button" onClick={() => setShowForgot(true)} className="text-[12px] font-medium" style={{ color: '#FF6B00' }}>
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="w-full px-4 py-3 pr-12 text-[14px] rounded-xl outline-none transition-all"
                  style={inputStyle}
                  placeholder="••••••••"
                  onFocus={e => { e.currentTarget.style.borderColor = '#FF6B00'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#ECECEC'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#AAAAAA] hover:text-[#555]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input {...register('rememberMe')} type="checkbox" className="w-4 h-4 rounded accent-[#FF6B00]" />
              <span className="text-[13px] text-[#555555]">Remember me</span>
            </label>

            {/* Submit */}
            <motion.button
              whileHover={!isLoading ? { scale: 1.01, y: -1 } : {}}
              whileTap={!isLoading ? { scale: 0.99 } : {}}
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-[15px] font-bold text-white rounded-xl transition-all mt-2"
              style={{
                background: isLoading ? '#DDDDDD' : '#FF6B00',
                boxShadow: !isLoading ? '0 4px 14px rgba(255,107,0,0.35)' : 'none',
              }}
            >
              {isLoading ? 'Signing in...' : (<>Sign In <ArrowRight size={16} /></>)}
            </motion.button>
          </form>

          <p className="text-center text-[13px] text-[#777777] mt-6">
            Don't have an account?{' '}
            <Link href="/register" className="font-semibold" style={{ color: '#FF6B00' }}>
              Register your center
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
            onClick={() => setShowForgot(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm p-6 rounded-2xl"
              style={{ background: '#FFFFFF', border: '1px solid #ECECEC' }}
            >
              <h3 className="text-[16px] font-bold text-[#111111] mb-1">Reset Password</h3>
              <p className="text-[13px] text-[#777777] mb-4">Enter your email to receive a reset link</p>
              <input
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                className="w-full px-4 py-3 text-[14px] rounded-xl outline-none mb-4"
                style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                placeholder="your@email.com"
                onFocus={e => { e.currentTarget.style.borderColor = '#FF6B00'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#ECECEC'; }}
              />
              <div className="flex gap-3">
                <button onClick={() => setShowForgot(false)}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border border-[#ECECEC] text-[#555]">
                  Cancel
                </button>
                <button onClick={handleForgotPassword} disabled={forgotLoading}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white"
                  style={{ background: '#FF6B00' }}>
                  {forgotLoading ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
