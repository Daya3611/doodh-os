'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { farmerService } from '@/services/farmerService';
import { farmerSchema, FarmerFormData } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Building2, Info } from 'lucide-react';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '20px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  padding: '28px',
};

const inputClass = 'w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all';
const inputStyle = { background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' };
const focusHandler = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = '#FF6B00'; };
const blurHandler = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = '#ECECEC'; };

export default function EditFarmerPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FarmerFormData>({
    resolver: zodResolver(farmerSchema) as any,
    defaultValues: {
      name: '',
      mobile: '',
      village: '',
      animalType: 'cow',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      aadhaarNumber: '',
      active: true,
      balance: 0,
    },
  });

  const animalType = watch('animalType');

  useEffect(() => {
    if (centerId && id) {
      farmerService.getById(centerId, id).then(farmer => {
        if (farmer) {
          reset({
            name: farmer.name,
            mobile: farmer.mobile,
            village: farmer.village,
            animalType: farmer.animalType,
            bankName: farmer.bankName || '',
            accountNumber: farmer.accountNumber || '',
            ifscCode: farmer.ifscCode || '',
            aadhaarNumber: farmer.aadhaarNumber || '',
            active: farmer.active,
            balance: farmer.balance || 0,
          });
        }
        setIsFetching(false);
      });
    }
  }, [centerId, id, reset]);

  const onSubmit = async (data: FarmerFormData) => {
    if (!centerId) { toast.error('No center found. Please log in again.'); return; }
    setIsLoading(true);
    try {
      await farmerService.update(centerId, id, data);
      toast.success(`Farmer updated`);
      router.push('/farmers');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update farmer');
      setIsLoading(false);
    }
  };

  const Section = ({ title, icon: Icon }: { title: string; icon: React.ElementType }) => (
    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#F0F0F0]">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FFF3E8' }}>
        <Icon size={15} style={{ color: '#FF6B00' }} />
      </div>
      <span className="text-[14px] font-bold text-[#111111]">{title}</span>
    </div>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">{label}</label>
      {children}
    </div>
  );

  if (isFetching) {
    return <div className="p-10 text-center">Loading farmer data...</div>;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Back */}
      <div className="flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#ECECEC] bg-white"
        >
          <ArrowLeft size={16} style={{ color: '#555' }} />
        </motion.button>
        <div>
          <div className="text-[11px] text-[#AAAAAA] uppercase tracking-wider">Farmers</div>
          <div className="text-[16px] font-bold text-[#111111]">Edit Farmer {id}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Personal Details */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
          <Section title="Personal Details" icon={User} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Full Name *">
              <input {...register('name')} className={inputClass} style={inputStyle} placeholder="Ramesh Patel" onFocus={focusHandler} onBlur={blurHandler} />
              {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name.message}</p>}
            </Field>
            <Field label="Mobile Number *">
              <input {...register('mobile')} className={inputClass} style={inputStyle} placeholder="9876543210" onFocus={focusHandler} onBlur={blurHandler} />
              {errors.mobile && <p className="text-[11px] text-red-500 mt-1">{errors.mobile.message}</p>}
            </Field>
            <Field label="Village *">
              <input {...register('village')} className={inputClass} style={inputStyle} placeholder="Shirpur" onFocus={focusHandler} onBlur={blurHandler} />
              {errors.village && <p className="text-[11px] text-red-500 mt-1">{errors.village.message}</p>}
            </Field>
            <Field label="Animal Type *">
              <div className="flex rounded-xl overflow-hidden border border-[#ECECEC]">
                {(['cow', 'buffalo'] as const).map(a => (
                  <button
                    key={a} type="button" onClick={() => setValue('animalType', a)}
                    className="flex-1 py-3 text-[14px] font-semibold capitalize transition-all"
                    style={{ background: animalType === a ? '#FF6B00' : '#F7F7F7', color: animalType === a ? '#FFFFFF' : '#777777' }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Aadhaar Number">
              <input {...register('aadhaarNumber')} className={inputClass} style={inputStyle} placeholder="1234 5678 9012" onFocus={focusHandler} onBlur={blurHandler} />
            </Field>
          </div>
        </motion.div>

        {/* Bank Details */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={cardStyle}>
          <Section title="Bank Details (Optional)" icon={Building2} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label="Bank Name">
              <input {...register('bankName')} className={inputClass} style={inputStyle} placeholder="SBI" onFocus={focusHandler} onBlur={blurHandler} />
            </Field>
            <Field label="Account Number">
              <input {...register('accountNumber')} className={inputClass} style={inputStyle} placeholder="XXXXXXXXXXXX" onFocus={focusHandler} onBlur={blurHandler} />
            </Field>
            <Field label="IFSC Code">
              <input {...register('ifscCode')} className={inputClass} style={inputStyle} placeholder="SBIN0001234" onFocus={focusHandler} onBlur={blurHandler} />
            </Field>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button" onClick={() => router.back()}
            className="px-6 py-2.5 rounded-xl text-[14px] font-semibold border border-[#ECECEC] text-[#555] hover:border-[#999] transition-colors"
          >
            Cancel
          </button>
          <motion.button
            whileHover={!isLoading ? { scale: 1.01, y: -1 } : {}}
            whileTap={!isLoading ? { scale: 0.99 } : {}}
            type="submit"
            disabled={isLoading}
            className="px-6 py-2.5 text-[14px] font-bold text-white rounded-xl"
            style={{
              background: isLoading ? '#DDDDDD' : '#FF6B00',
              boxShadow: !isLoading ? '0 4px 14px rgba(255,107,0,0.35)' : 'none',
            }}
          >
            {isLoading ? 'Updating...' : 'Update Farmer'}
          </motion.button>
        </div>
      </form>
    </div>
  );
}
