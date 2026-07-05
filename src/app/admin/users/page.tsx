'use client';

import { useEffect, useState } from 'react';
import { adminService, AdminUser } from '@/services/adminService';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, ToggleRight, ToggleLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function MasterUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getAllUsers();
      setUsers(data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || 
                          u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-[#ECECEC] rounded-xl text-[14px] outline-none focus:border-[#FF6B00] transition-colors"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-3 bg-white border border-[#ECECEC] rounded-xl text-[14px] outline-none focus:border-[#FF6B00]"
        >
          <option value="ALL">All Roles</option>
          <option value="OWNER">Owners</option>
          <option value="STAFF">Staff</option>
          <option value="MASTER_ADMIN">Master Admin</option>
        </select>
      </div>

      {/* Users Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-[#ECECEC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA]">
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Center ID</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#F0F0F0]">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-gray-100 rounded-full animate-pulse w-3/4"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center">
                        <Users size={32} className="text-orange-500" />
                      </div>
                      <div className="text-[16px] font-bold text-[#111]">No users found</div>
                      <div className="text-[14px] text-[#888]">Try adjusting your search or filters.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {filteredUsers.map((user, i) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[12px] font-bold flex-shrink-0">
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <div className="text-[14px] font-bold text-[#111]">{user.name}</div>
                            <div className="text-[12px] text-[#888]">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          user.role === 'MASTER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                          user.role === 'OWNER' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[13px] text-[#555] font-mono">
                          {user.centerId ? user.centerId.slice(0, 8) + '...' : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`flex items-center gap-1.5 text-[12px] font-semibold ${user.active !== false ? 'text-green-600' : 'text-gray-400'}`}>
                          {user.active !== false ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          {user.active !== false ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => toast.info('Edit functionality placeholder')}
                          className="text-[13px] font-semibold text-[#FF6B00] hover:underline"
                        >
                          Manage
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
