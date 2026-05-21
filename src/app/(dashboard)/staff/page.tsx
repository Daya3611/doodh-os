'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { staffService, StaffMember, StaffFormData, staffSchema } from '@/services/staffService';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Pencil, Trash2, UserCog, ToggleLeft, ToggleRight } from 'lucide-react';

const cardStyle = { background: '#FFFFFF', borderRadius: '20px', border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };

const shiftColors: Record<string, { bg: string; color: string }> = {
  morning: { bg: '#FEF9C3', color: '#CA8A04' },
  evening: { bg: '#EDE9FE', color: '#7C3AED' },
  both: { bg: '#DBEAFE', color: '#2563EB' },
};

const roleColors: Record<string, { bg: string; color: string }> = {
  OWNER: { bg: '#FFF3E8', color: '#FF6B00' },
  STAFF: { bg: '#F0F0F0', color: '#555555' },
};

export default function StaffPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: { name: '', phone: '', email: '', role: 'STAFF', shift: 'morning', active: true },
  });
  const shiftVal = watch('shift');
  const roleVal = watch('role');

  const load = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try { setStaffList(await staffService.getAll(centerId)); }
    catch { toast.error('Failed to load staff'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, [centerId]);

  const onSubmit = async (data: StaffFormData) => {
    if (!centerId) return;
    try {
      if (editingId) {
        await staffService.update(centerId, editingId, data);
        toast.success('Staff member updated');
      } else {
        await staffService.add(centerId, data);
        toast.success('Staff member added');
      }
      setShowForm(false);
      setEditingId(null);
      reset();
      load();
    } catch { toast.error('Failed to save'); }
  };

  const handleEdit = (s: StaffMember) => {
    setEditingId(s.id);
    reset({ name: s.name, phone: s.phone, email: s.email, role: s.role, shift: s.shift, active: s.active });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!centerId || !confirm('Remove this staff member?')) return;
    try { await staffService.delete(centerId, id); toast.success('Removed'); load(); }
    catch { toast.error('Failed to remove'); }
  };

  const handleToggleActive = async (s: StaffMember) => {
    if (!centerId) return;
    try {
      await staffService.update(centerId, s.id, { active: !s.active });
      toast.success(`Staff ${!s.active ? 'activated' : 'deactivated'}`);
      load();
    } catch { toast.error('Failed to update'); }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const inputStyle = { background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' };
  const fc = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#FF6B00'; };
  const bc = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#ECECEC'; };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
          onClick={() => { setEditingId(null); reset(); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white"
          style={{ background: '#FF6B00', borderRadius: '14px', boxShadow: '0 2px 8px rgba(255,107,0,0.3)' }}
        >
          <Plus size={17} /> Add Staff
        </motion.button>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={cardStyle} className="overflow-hidden">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
              {['Staff Member', 'Phone', 'Role', 'Shift', 'Status', ''].map(col => (
                <th key={col} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#AAAAAA' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F7F7F7' }}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 rounded-full animate-pulse" style={{ background: '#F0F0F0', width: j === 0 ? '140px' : '70px' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : staffList.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#FFF3E8' }}>
                      <UserCog size={26} style={{ color: '#FF6B00' }} />
                    </div>
                    <div className="text-[15px] font-semibold text-[#111111]">No staff added yet</div>
                    <div className="text-[13px] text-[#777777]">Add your first staff member</div>
                  </div>
                </td>
              </tr>
            ) : (
              <AnimatePresence>
                {staffList.map((s, i) => (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }}
                    style={{ borderBottom: '1px solid #F7F7F7' }} className="group hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                          style={{ background: '#FFF3E8', color: '#FF6B00' }}>
                          {getInitials(s.name)}
                        </div>
                        <div>
                          <div className="text-[14px] font-semibold text-[#111111]">{s.name}</div>
                          <div className="text-[11px] text-[#AAAAAA]">{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-[#555]">{s.phone}</td>
                    <td className="px-6 py-4">
                      <span className="text-[12px] font-semibold px-2.5 py-1 rounded-lg" style={roleColors[s.role] || roleColors.STAFF}>
                        {s.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[12px] font-medium px-2.5 py-1 rounded-lg capitalize" style={shiftColors[s.shift] || shiftColors.morning}>
                        {s.shift}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleToggleActive(s)} className="flex items-center gap-1.5 cursor-pointer">
                        {s.active
                          ? <ToggleRight size={20} style={{ color: '#22C55E' }} />
                          : <ToggleLeft size={20} style={{ color: '#AAAAAA' }} />}
                        <span className="text-[12px] font-semibold" style={{ color: s.active ? '#16A34A' : '#999' }}>
                          {s.active ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(s)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#F0F0F0' }}>
                          <Pencil size={13} style={{ color: '#555' }} />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FEE2E2' }}>
                          <Trash2 size={13} style={{ color: '#DC2626' }} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: '#FFFFFF', border: '1px solid #ECECEC', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="text-[17px] font-bold text-[#111111]">{editingId ? 'Edit Staff' : 'Add Staff Member'}</div>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#F0F0F0' }}>
                  <X size={15} style={{ color: '#555' }} />
                </button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[11px] font-semibold text-[#777] uppercase tracking-wider mb-1.5 block">Full Name</label>
                    <input {...register('name')} className="w-full px-4 py-2.5 text-[14px] rounded-xl outline-none" style={inputStyle} placeholder="Arvind Kumar" onFocus={fc} onBlur={bc} />
                    {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#777] uppercase tracking-wider mb-1.5 block">Phone</label>
                    <input {...register('phone')} className="w-full px-4 py-2.5 text-[14px] rounded-xl outline-none" style={inputStyle} placeholder="9876543210" onFocus={fc} onBlur={bc} />
                    {errors.phone && <p className="text-[11px] text-red-500 mt-1">{errors.phone.message}</p>}
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#777] uppercase tracking-wider mb-1.5 block">Email</label>
                    <input {...register('email')} type="email" className="w-full px-4 py-2.5 text-[14px] rounded-xl outline-none" style={inputStyle} placeholder="staff@doodh.com" onFocus={fc} onBlur={bc} />
                    {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#777] uppercase tracking-wider mb-1.5 block">Role</label>
                  <div className="flex rounded-xl overflow-hidden border border-[#ECECEC]">
                    {(['STAFF', 'OWNER'] as const).map(r => (
                      <button key={r} type="button" onClick={() => setValue('role', r)}
                        className="flex-1 py-2.5 text-[13px] font-semibold transition-all"
                        style={{ background: roleVal === r ? '#FF6B00' : '#F7F7F7', color: roleVal === r ? '#FFF' : '#777' }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#777] uppercase tracking-wider mb-1.5 block">Shift</label>
                  <div className="flex rounded-xl overflow-hidden border border-[#ECECEC]">
                    {(['morning', 'evening', 'both'] as const).map(s => (
                      <button key={s} type="button" onClick={() => setValue('shift', s)}
                        className="flex-1 py-2.5 text-[12px] font-semibold capitalize transition-all"
                        style={{ background: shiftVal === s ? '#FF6B00' : '#F7F7F7', color: shiftVal === s ? '#FFF' : '#777' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[#ECECEC] text-[#555]">Cancel</button>
                  <button type="submit" className="flex-1 py-3 rounded-xl text-[14px] font-bold text-white" style={{ background: '#FF6B00', boxShadow: '0 4px 14px rgba(255,107,0,0.35)' }}>
                    {editingId ? 'Update' : 'Add Staff'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
