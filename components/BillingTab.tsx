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
import { SortHeader } from './SortHeader';

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
  const [voidError, setVoidError] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Sort State - Default is date created DESC per specification
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Sensible defaults when switching fields
      if (['created_at', 'amount_due', 'list_price_snapshot', 'discount_amount'].includes(field)) {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  const filteredInvoices = invoices
    .filter((inv) => {
      const matchesSearch =
        inv.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.student_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'student_name':
          comparison = (a.student_name || '').localeCompare(b.student_name || '', undefined, { sensitivity: 'base' });
          break;
        case 'code':
          comparison = (a.code || '').localeCompare(b.code || '');
          break;
        case 'package_name':
          comparison = (a.package_name || '').localeCompare(b.package_name || '');
          break;
        case 'list_price_snapshot':
          comparison = (a.list_price_snapshot || 0) - (b.list_price_snapshot || 0);
          break;
        case 'discount_amount':
          comparison = (a.discount_amount || 0) - (b.discount_amount || 0);
          break;
        case 'amount_due':
          comparison = (a.amount_due || 0) - (b.amount_due || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'created_at':
        default: {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
      }

      if (comparison !== 0) {
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Secondary sort: created_at DESC
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

  // Students with active enrollments, sorted alphabetically by student name (natural sort)
  const billableStudents = [...students]
    .filter((s) => s.enrollment_id)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

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
        setStatusMessage('Invoice marked as PAID! Future session slots generated automatically.');
        setTimeout(() => setStatusMessage(''), 5000);
      }
      onRefresh();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
      setTimeout(() => setStatusMessage(''), 6000);
    }
  };

  const handleConfirmVoid = async () => {
    if (!invoiceToVoid) return;
    setIsVoiding(true);
    setVoidError('');
    try {
      const res = await apiFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_invoice_status',
          payload: {
            invoice_id: invoiceToVoid.id,
            to_status: 'void',
            reason: voidReason || null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsVoidModalOpen(false);
      setInvoiceToVoid(null);
      setStatusMessage(`Invoice ${invoiceToVoid.code} was successfully voided.`);
      setTimeout(() => setStatusMessage(''), 5000);
      onRefresh();
    } catch (err: any) {
      setVoidError(err.message || 'Failed to void invoice');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-slate-900">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-1 items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice code or student..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#6dd95d]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#6dd95d]"
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
          className="flex items-center space-x-2 px-4 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 text-xs font-bold rounded-xl shadow-xs transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Invoice</span>
        </button>
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">
                  <SortHeader label="Invoice Code / Date" field="created_at" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                </th>
                <th className="py-3 px-4">
                  <SortHeader label="Student & Class" field="student_name" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                </th>
                <th className="py-3 px-4">
                  <SortHeader label="Package" field="package_name" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                </th>
                <th className="py-3 px-4 text-right">
                  <SortHeader label="List Price" field="list_price_snapshot" currentField={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                </th>
                <th className="py-3 px-4 text-right">
                  <SortHeader label="Discount" field="discount_amount" currentField={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                </th>
                <th className="py-3 px-4 text-right font-bold text-slate-900">
                  <SortHeader label="Amount Due" field="amount_due" currentField={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                </th>
                <th className="py-3 px-4 text-center">
                  <SortHeader label="Status" field="status" currentField={sortField} direction={sortDirection} onSort={handleSort} align="center" />
                </th>
                <th className="py-3 px-4 text-center text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                  Slot Generation
                </th>
                <th className="py-3 px-4 text-right text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {inv.code}
                      <div className="text-[10px] text-slate-500 font-normal">
                        {formatDateOnly(inv.created_at)}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{inv.student_name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                        <span className="font-mono text-slate-700">{inv.student_code}</span>
                        <span>•</span>
                        <span className="font-mono text-blue-700 font-bold">{inv.class_code}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-800">
                      {inv.package_name} ({inv.sessions_snapshot} sessions)
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      {formatRupiah(inv.list_price_snapshot)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono">
                      {inv.discount_amount > 0 ? (
                        <div>
                          <span className="text-amber-800 font-bold">-{formatRupiah(inv.discount_amount)}</span>
                          <div className="text-[10px] text-slate-500 italic truncate max-w-[120px]">
                            {inv.discount_reason}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900 text-sm bg-slate-50/70">
                      {formatRupiah(inv.amount_due)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="relative group inline-flex justify-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase cursor-default ${
                            inv.status === 'paid'
                              ? 'bg-[#6dd95d]/20 text-emerald-950 border border-[#6dd95d]/40'
                              : inv.status === 'sent'
                              ? 'bg-[#65acff]/20 text-blue-950 border border-[#65acff]/40'
                              : inv.status === 'draft'
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : 'bg-[#f77f73]/20 text-rose-950 border border-[#f77f73]/40'
                          }`}
                        >
                          {inv.status}
                        </span>

                        {/* Status details visible ONLY on hover */}
                        <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 px-2.5 py-1 bg-slate-900 text-white text-[10px] rounded-md shadow-md whitespace-nowrap">
                          {inv.status === 'paid' && (inv.paid_at ? `Paid on ${formatDateOnly(inv.paid_at)}` : 'Paid in full')}
                          {inv.status === 'sent' && `Sent: ${formatDateOnly(inv.created_at)}`}
                          {inv.status === 'draft' && `Created: ${formatDateOnly(inv.created_at)}`}
                          {inv.status === 'void' && (inv.void_reason ? `Void: ${inv.void_reason}` : 'Voided invoice')}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {inv.slots_generated_at ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-950 bg-[#6dd95d]/20 px-2 py-0.5 rounded-full border border-[#6dd95d]/40">
                          <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                          <span>Generated</span>
                        </span>
                      ) : inv.status === 'paid' ? (
                        <span className="text-[10px] font-bold text-amber-950 bg-[#fdb01b]/20 px-2 py-0.5 rounded-full border border-[#fdb01b]/40">
                          Pending Schedule
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Upon payment</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {inv.status === 'draft' && (
                        <button
                          onClick={() => handleUpdateStatus(inv.id, 'sent')}
                          className="px-2.5 py-1 text-[11px] bg-[#65acff] hover:bg-blue-400 text-slate-950 font-bold rounded-lg transition"
                        >
                          Send
                        </button>
                      )}

                      {inv.status === 'sent' && (
                        <button
                          onClick={() => handleUpdateStatus(inv.id, 'paid')}
                          className="px-2.5 py-1 text-[11px] bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 font-bold rounded-lg shadow-xs transition"
                        >
                          Mark Paid
                        </button>
                      )}

                      {/* Void Button: active for draft/sent, muted with explanatory tooltip for paid/void */}
                      {inv.status === 'void' ? (
                        <button
                          type="button"
                          disabled
                          title="Invoice is already voided"
                          className="text-[10px] text-slate-300 opacity-60 cursor-not-allowed py-0.5 px-1 font-medium select-none"
                        >
                          Void
                        </button>
                      ) : inv.status === 'paid' ? (
                        <button
                          type="button"
                          disabled
                          title={(inv.consumed_credits ?? 0) > 0 ? "Credits already consumed; use credit adjustment instead" : "Paid invoice with active schedule cannot be voided directly; use credit adjustment"}
                          className="text-[10px] text-slate-300 opacity-60 cursor-not-allowed py-0.5 px-1 font-medium select-none"
                        >
                          Void
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setInvoiceToVoid(inv);
                            setVoidError('');
                            setIsVoidModalOpen(true);
                          }}
                          title="Void this invoice"
                          className="text-[10px] text-slate-400 hover:text-rose-600 font-semibold py-0.5 px-1 transition"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Create Package Invoice</h3>
              <button onClick={() => setIsNewInvoiceOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-[#f77f73]/15 border border-[#f77f73]/30 text-rose-900 text-xs rounded-xl flex items-center space-x-2 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreateInvoice} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Enrolled Student *</label>
                <select
                  value={selectedEnrollmentId}
                  onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                >
                  {billableStudents.map((s) => (
                    <option key={s.enrollment_id} value={s.enrollment_id}>
                      {s.name} ({s.code}) — Class: {s.class_code} ({s.class_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Session Package *</label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                >
                  {masterData.packages.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sessions_count} sessions)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Discount Amount (IDR)</label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseInt(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                  placeholder="0"
                />
              </div>

              {discountAmount > 0 && (
                <div>
                  <label className="text-xs font-semibold text-amber-900">
                    Discount Reason * (Mandatory constraint under PRD rule)
                  </label>
                  <input
                    type="text"
                    required
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="e.g. Friends and family, promotional voucher"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-[#fdb01b] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
                  />
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1">
                <div className="font-semibold flex items-center space-x-1">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  <span>Automatic Slot Generation</span>
                </div>
                <p className="text-slate-600">
                  List price is resolved dynamically from the package prices matrix. When marked PAID, slots land on class schedule days and skip holidays.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewInvoiceOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 text-xs font-bold rounded-xl shadow-xs"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-rose-700">Void Invoice</h3>
              <button onClick={() => setIsVoidModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs text-slate-700">
              Voiding invoice <strong className="font-mono text-slate-900">{invoiceToVoid.code}</strong>.
              <br />
              <span className="text-slate-500 mt-1 block">
                Rule: A paid invoice can only be voided if 0 credits have been consumed. If sessions were already attended, a credit adjustment must be used instead.
              </span>
            </p>

            {voidError && (
              <div className="p-3 bg-[#f77f73]/15 border border-[#f77f73]/30 text-rose-900 text-xs rounded-xl flex items-center space-x-2 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{voidError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700">Void Reason *</label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#6dd95d]"
              />
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isVoiding}
                onClick={handleConfirmVoid}
                className="px-4 py-2 bg-[#f77f73] hover:bg-rose-500 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl shadow-xs transition"
              >
                {isVoiding ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
