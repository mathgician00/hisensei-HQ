'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  CreditCard,
  CheckCircle,
  Clock,
  Plus,
  Send,
  Ban,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Tag,
  Search,
  Filter,
  Sparkles,
} from 'lucide-react';
import { InvoiceItem, Student } from '@/src/services/tutoringService';
import { formatRupiah, formatDateOnly } from '@/lib/formatters';

interface BillingTabProps {
  invoices: InvoiceItem[];
  students: Student[];
  masterData: any;
  onRefresh: () => void;
  preselectedEnrollmentId?: string;
}

export const BillingTab: React.FC<BillingTabProps> = ({
  invoices,
  students,
  masterData,
  onRefresh,
  preselectedEnrollmentId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // New Invoice Modal
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(preselectedEnrollmentId || '');
  const [selectedPackageId, setSelectedPackageId] = useState(masterData.packages[0]?.id || '');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Void modal
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [invoiceToVoid, setInvoiceToVoid] = useState<InvoiceItem | null>(null);
  const [voidReason, setVoidReason] = useState('Incorrect package selected');

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.student_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Students with active enrollments
  const billableStudents = students.filter((s) => s.enrollment_id);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    if (discountAmount > 0 && !discountReason.trim()) {
      setErrorMessage('Discount reason is mandatory when discount is greater than 0.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_invoice',
          payload: {
            enrollment_id: selectedEnrollmentId,
            package_id: selectedPackageId,
            discount_amount: discountAmount,
            discount_reason: discountAmount > 0 ? discountReason : null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsNewInvoiceOpen(false);
      setDiscountAmount(0);
      setDiscountReason('');
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (invoiceId: string, toStatus: 'sent' | 'paid' | 'void', reason?: string) => {
    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_invoice_status',
          payload: {
            invoice_id: invoiceId,
            to_status: toStatus,
            reason: reason || null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (toStatus === 'paid') {
        alert('Invoice marked as PAID! Database trigger automatically generated future session attendance slots.');
      }
      onRefresh();
    } catch (err: any) {
      alert(`Error updating invoice: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex flex-1 items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice code or student..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">All Invoices</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent (Unpaid)</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </select>
        </div>

        <button
          onClick={() => {
            if (billableStudents.length > 0 && !selectedEnrollmentId) {
              setSelectedEnrollmentId(billableStudents[0].enrollment_id!);
            }
            setErrorMessage('');
            setIsNewInvoiceOpen(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Invoice</span>
        </button>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">Invoice Code</th>
                <th className="py-3 px-4">Student & Class</th>
                <th className="py-3 px-4">Package</th>
                <th className="py-3 px-4 text-right">List Price</th>
                <th className="py-3 px-4 text-right">Discount</th>
                <th className="py-3 px-4 text-right font-bold text-white">Amount Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Slot Generation</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 italic">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                      {inv.code}
                      <div className="text-[10px] text-slate-500 font-normal">
                        {formatDateOnly(inv.created_at)}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{inv.student_name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5">
                        <span className="font-mono text-indigo-300">{inv.student_code}</span>
                        <span>•</span>
                        <span className="font-mono text-cyan-400">{inv.class_code}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-200">
                      {inv.package_name} ({inv.sessions_snapshot} sessions)
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {formatRupiah(inv.list_price_snapshot)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono">
                      {inv.discount_amount > 0 ? (
                        <div>
                          <span className="text-amber-400">-{formatRupiah(inv.discount_amount)}</span>
                          <div className="text-[10px] text-slate-400 italic truncate max-w-[120px]">
                            {inv.discount_reason}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-extrabold text-white text-sm bg-slate-800/20">
                      {formatRupiah(inv.amount_due)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                          inv.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : inv.status === 'sent'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : inv.status === 'draft'
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {inv.status}
                      </span>
                      {inv.paid_at && (
                        <div className="text-[9px] text-slate-400 mt-0.5 font-mono">
                          {formatDateOnly(inv.paid_at)}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {inv.slots_generated_at ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Generated</span>
                        </span>
                      ) : inv.status === 'paid' ? (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Pending Schedule
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Upon payment</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {inv.status === 'draft' && (
                        <button
                          onClick={() => handleUpdateStatus(inv.id, 'sent')}
                          className="px-2.5 py-1 text-[11px] bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition"
                        >
                          Send
                        </button>
                      )}

                      {inv.status === 'sent' && (
                        <button
                          onClick={() => handleUpdateStatus(inv.id, 'paid')}
                          className="px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm transition"
                        >
                          Mark Paid
                        </button>
                      )}

                      {inv.status !== 'void' && (
                        <button
                          onClick={() => {
                            setInvoiceToVoid(inv);
                            setIsVoidModalOpen(true);
                          }}
                          className="text-[10px] text-slate-500 hover:text-rose-400 py-0.5 px-1 transition"
                        >
                          Void...
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: New Invoice */}
      {isNewInvoiceOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Create Package Invoice</h3>
              <button onClick={() => setIsNewInvoiceOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreateInvoice} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Enrolled Student *</label>
                <select
                  value={selectedEnrollmentId}
                  onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                >
                  {billableStudents.map((s) => (
                    <option key={s.enrollment_id} value={s.enrollment_id}>
                      {s.name} ({s.code}) — Class: {s.class_code} ({s.class_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Session Package *</label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                >
                  {masterData.packages.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sessions_count} sessions)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Discount Amount (IDR)</label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseInt(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                  placeholder="0"
                />
              </div>

              {discountAmount > 0 && (
                <div>
                  <label className="text-xs font-medium text-amber-300">
                    Discount Reason * (Mandatory constraint under PRD rule)
                  </label>
                  <input
                    type="text"
                    required
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="e.g. Friends and family, promotional voucher"
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-amber-500/50 rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>
              )}

              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 space-y-1">
                <div className="font-semibold flex items-center space-x-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Automatic Slot Generation</span>
                </div>
                <p>
                  List price is resolved dynamically from the package prices matrix. When marked PAID, slots land on class schedule days and skip holidays.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewInvoiceOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                >
                  {isSubmitting ? 'Creating...' : 'Generate Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Void Invoice */}
      {isVoidModalOpen && invoiceToVoid && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-rose-400">Void Invoice</h3>
              <button onClick={() => setIsVoidModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Voiding invoice <strong className="font-mono text-white">{invoiceToVoid.code}</strong>.
              <br />
              <span className="text-slate-400 mt-1 block">
                Rule: A paid invoice can only be voided if 0 credits have been consumed. If sessions were already attended, a credit adjustment must be used instead.
              </span>
            </p>

            <div>
              <label className="text-xs font-medium text-slate-300">Void Reason *</label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
              />
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleUpdateStatus(invoiceToVoid.id, 'void', voidReason);
                  setIsVoidModalOpen(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
