'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Droplets, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const registerSchema = z.object({
  centerName: z.string().min(2, 'Center name is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Valid phone number required'),
  password: z.string().min(6, 'Minimum 6 characters'),
});

type RegisterForm = z.infer<typeof registerSchema>;

const steps = ['Center Info', 'Account Setup'];

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(0);

  const { register, handleSubmit, trigger, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { centerName: '', ownerName: '', email: '', phone: '', password: '' },
  });

  const nextStep = async () => {
    const valid = await trigger(step === 0 ? ['centerName', 'ownerName'] : ['email', 'phone', 'password']);
    if (valid) setStep(1);
  };

  const onSubmit = async (values: RegisterForm) => {
    setIsLoading(true);
    try {
      // 1. Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const uid = cred.user.uid;

      await updateProfile(cred.user, { displayName: values.ownerName });

      // 2. Use a batch write to atomically create all center sub-documents
      const batch = writeBatch(db);

      // Center document
      const centerRef = doc(db, 'centers', uid);
      batch.set(centerRef, {
        name: values.centerName,
        ownerId: uid,
        ownerName: values.ownerName,
        email: values.email,
        phone: values.phone,
        active: true,
        createdAt: serverTimestamp(),
      });

      // Initialize counters (farmerCounter starts at 0)
      const countersRef = doc(db, 'centers', uid, 'settings', 'counters');
      batch.set(countersRef, { farmerCounter: 0 });

      // Default center settings
      const settingsRef = doc(db, 'centers', uid, 'settings', 'general');
      batch.set(settingsRef, {
        receiptFooter: 'Thank you for your business!',
        autoPrint: false,
        smsEnabled: false,
        whatsappEnabled: false,
        language: 'en',
        darkMode: false,
        updatedAt: serverTimestamp(),
      });

      // User profile in global users collection
      const userRef = doc(db, 'users', uid);
      batch.set(userRef, {
        name: values.ownerName,
        email: values.email,
        phone: values.phone,
        role: 'OWNER',
        centerId: uid,
        active: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      toast.success('Center created successfully! Welcome to DoodhOS.');
      router.push('/dashboard');
    } catch (error: any) {
      const msg =
        error.code === 'auth/email-already-in-use' ? 'This email is already registered' :
        error.message || 'Registration failed';
      toast.error(msg);
      setIsLoading(false);
    }
  };

  const inputStyle = { background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' };
  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#FF6B00'; };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#ECECEC'; };

  return (
    <div className="min-h-screen flex" style={{ background: '#F7F7F7' }}>
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] p-12 flex-shrink-0" style={{ background: '#FF6B00' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
            <Droplets size={22} color="white" />
          </div>
          <span className="text-white font-bold text-xl">DoodhOS</span>
        </div>
        <div className="space-y-5">
          <h1 className="text-white text-4xl font-extrabold leading-tight">
            Start managing your dairy center today
          </h1>
          {['Auto-generate F001 farmer IDs', 'FAT/SNF based rate calculation', 'Daily & monthly collection reports', 'Offline-ready with Firebase sync'].map(f => (
            <div key={f} className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-white flex-shrink-0" />
              <span className="text-white/80 text-[14px]">{f}</span>
            </div>
          ))}
        </div>
        <p className="text-white/50 text-[13px]">Free to start. No credit card required.</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#FF6B00' }}>
              <Droplets size={16} color="white" />
            </div>
            <span className="font-bold text-lg text-[#111111]">DoodhOS</span>
          </div>

          <div className="mb-8">
            <h2 className="text-[28px] font-bold text-[#111111]">Create your center</h2>
            <p className="text-[14px] text-[#777777] mt-1">Set up your milk collection center in 2 minutes</p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all"
                  style={{
                    background: i <= step ? '#FF6B00' : '#ECECEC',
                    color: i <= step ? '#FFFFFF' : '#AAAAAA',
                  }}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="text-[12px] font-medium" style={{ color: i <= step ? '#111111' : '#AAAAAA' }}>{s}</span>
                {i < steps.length - 1 && <div className="w-8 h-px" style={{ background: i < step ? '#FF6B00' : '#ECECEC' }} />}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {step === 0 && (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Center Name</label>
                  <input {...register('centerName')} className="w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all" style={inputStyle} placeholder="Shree Krishna Dairy" onFocus={focusStyle} onBlur={blurStyle} />
                  {errors.centerName && <p className="text-[11px] text-red-500 mt-1">{errors.centerName.message}</p>}
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Owner Name</label>
                  <input {...register('ownerName')} className="w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all" style={inputStyle} placeholder="Ramesh Sharma" onFocus={focusStyle} onBlur={blurStyle} />
                  {errors.ownerName && <p className="text-[11px] text-red-500 mt-1">{errors.ownerName.message}</p>}
                </div>
                <button type="button" onClick={nextStep}
                  className="w-full flex items-center justify-center gap-2 py-3.5 text-[15px] font-bold text-white rounded-xl mt-2"
                  style={{ background: '#FF6B00', boxShadow: '0 4px 14px rgba(255,107,0,0.35)' }}>
                  Next Step <ArrowRight size={16} />
                </button>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Email</label>
                  <input {...register('email')} type="email" className="w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all" style={inputStyle} placeholder="owner@doodhos.com" onFocus={focusStyle} onBlur={blurStyle} />
                  {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Phone</label>
                  <input {...register('phone')} className="w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all" style={inputStyle} placeholder="9876543210" onFocus={focusStyle} onBlur={blurStyle} />
                  {errors.phone && <p className="text-[11px] text-red-500 mt-1">{errors.phone.message}</p>}
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Password</label>
                  <div className="relative">
                    <input {...register('password')} type={showPassword ? 'text' : 'password'} className="w-full px-4 py-3 pr-12 text-[14px] rounded-xl outline-none transition-all" style={inputStyle} placeholder="••••••••" onFocus={focusStyle} onBlur={blurStyle} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#AAAAAA]">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-[11px] text-red-500 mt-1">{errors.password.message}</p>}
                </div>
                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep(0)}
                    className="flex-1 py-3.5 rounded-xl text-[14px] font-semibold border border-[#ECECEC] text-[#555]">
                    Back
                  </button>
                  <motion.button
                    whileHover={!isLoading ? { scale: 1.01, y: -1 } : {}}
                    whileTap={!isLoading ? { scale: 0.99 } : {}}
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 text-[15px] font-bold text-white rounded-xl"
                    style={{ background: isLoading ? '#DDDDDD' : '#FF6B00', boxShadow: !isLoading ? '0 4px 14px rgba(255,107,0,0.35)' : 'none' }}>
                    {isLoading ? 'Creating...' : 'Create Center'}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </form>

          <p className="text-center text-[13px] text-[#777777] mt-6">
            Already registered?{' '}
            <Link href="/login" className="font-semibold" style={{ color: '#FF6B00' }}>Sign in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
