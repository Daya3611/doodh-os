'use client';

import { useEffect, useState } from 'react';
import { adminService, AdminCenter } from '@/services/adminService';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ReceiptText, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function MasterPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [centers, setCenters] = useState<Record<string, AdminCenter>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [paymentsData, centersData] = await Promise.all([
        adminService.getAllPayments(),
        adminService.getAllCenters()
      ]);
      
      const centersMap: Record<string, AdminCenter> = {};
      centersData.forEach(c => {
        centersMap[c.id] = c;
      });
      
      setCenters(centersMap);
      setPayments(paymentsData);
    } catch (error) {
      toast.error('Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatDate = (dateData: any) => {
    if (!dateData) return '-';
    const d = dateData.toDate ? dateData.toDate() : new Date(dateData);
    return d.toLocaleDateString('en-IN', { 
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const filteredPayments = payments.filter(p => {
    const centerName = centers[p.centerId]?.name || '';
    const q = search.toLowerCase();
    return (
      centerName.toLowerCase().includes(q) ||
      p.razorpayPaymentId?.toLowerCase().includes(q) ||
      p.paymentId?.toLowerCase().includes(q) ||
      p.centerId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-[20px] font-bold text-[#111]">Payments</h2>
        
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by center, payment ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-[#ECECEC] rounded-xl text-[14px] outline-none focus:border-[#FF6B00] transition-colors"
          />
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-[#ECECEC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA]">
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Payment ID</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Center</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Date</th>
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
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                        <ReceiptText size={32} className="text-blue-500" />
                      </div>
                      <div className="text-[16px] font-bold text-[#111]">No payments found</div>
                      <div className="text-[14px] text-[#888]">No transactions match your search.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {filteredPayments.map((payment, i) => (
                    <motion.tr
                      key={payment.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="text-[14px] font-bold text-[#111] font-mono">{payment.razorpayPaymentId || payment.paymentId}</div>
                        <div className="text-[12px] text-[#888] font-mono mt-0.5">{payment.razorpayOrderId || payment.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[14px] font-bold text-[#111]">{centers[payment.centerId]?.name || 'Unknown Center'}</div>
                        <div className="text-[12px] text-[#888]">ID: {payment.centerId.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[14px] font-bold text-[#111]">₹{payment.amount}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold ${
                          payment.status === 'SUCCESS' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {payment.status === 'SUCCESS' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                          {payment.status || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[14px] text-[#444]">{formatDate(payment.paidAt)}</div>
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
