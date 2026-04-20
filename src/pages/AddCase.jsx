import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Upload, X, Eye, Plus, Filter, Search, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import {
  getCredits,
  saveCredit,
  getLedger,
  saveLedger,
  getSettings
} from '../utils/storageManager';
import {
  generateId,
  generateSerialNumber,
  formatDate,
  formatCurrency,
  fileToBase64,
  getTodayDate,
  createLedgerEntry,
  calculateBalance
} from '../utils/helpers';

export default function AddCase() {
  const { user } = useAuthStore();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    personName: user?.name || '',
    date: getTodayDate(),
    amount: '',
    paymentMode: 'Cash',
    remarks: ''
  });

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    personName: '',
    mode: '',
    searchQuery: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const credits = getCredits();

  const filteredCredits = credits.filter(credit => {
    if (filters.fromDate && credit.date < filters.fromDate) return false;
    if (filters.toDate && credit.date > filters.toDate) return false;
    if (filters.personName && credit.personName !== filters.personName) return false;
    if (filters.mode && credit.paymentMode !== filters.mode) return false;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const match = (
        (credit.sn && String(credit.sn).toLowerCase().includes(q)) ||
        (credit.personName && credit.personName.toLowerCase().includes(q)) ||
        (credit.date && credit.date.includes(q)) ||
        (credit.amount && String(credit.amount).toLowerCase().includes(q)) ||
        (credit.paymentMode && credit.paymentMode.toLowerCase().includes(q)) ||
        (credit.remarks && credit.remarks.toLowerCase().includes(q))
      );
      if (!match) return false;
    }

    return true;
  });

  const sortedCredits = filteredCredits.slice().reverse();
  const totalPages = Math.ceil(sortedCredits.length / itemsPerPage);
  const paginatedCredits = sortedCredits.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const pageTotalAmount = paginatedCredits.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
  const totalAmount = sortedCredits.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setImage(base64);
      setImagePreview(base64);
    } catch (error) {
      toast.error('Error reading image');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.personName.trim()) {
      toast.error('Please enter person name');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter valid credit amount');
      return;
    }

    try {
      setLoading(true);

      const newCredit = {
        id: generateId(),
        sn: generateSerialNumber(),
        personName: formData.personName,
        date: formData.date,
        amount: parseFloat(formData.amount),
        paymentMode: formData.paymentMode,
        image: image || '',
        remarks: formData.remarks,
        status: 'APPROVED',
        timestamp: new Date().toISOString()
      };

      // Save credit
      saveCredit(newCredit);

      // Calculate new balance
      const updatedCredits = getCredits();
      const newBalance = calculateBalance(
        formData.personName,
        updatedCredits,
        getLedger()
      );

      // Create ledger entry
      const ledgerEntry = createLedgerEntry(
        newCredit.id,
        formData.personName,
        'CREDIT',
        formData.amount,
        formData.date,
        newCredit.id,
        newBalance
      );

      saveLedger(ledgerEntry);

      toast.success(`Credit of ${formatCurrency(formData.amount)} added successfully!`);

      // Reset form
      setFormData({
        personName: user?.name || '',
        date: getTodayDate(),
        amount: '',
        paymentMode: 'Cash',
        remarks: ''
      });
      setImage(null);
      setImagePreview('');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Automatically close the modal after 3 seconds as requested
      setTimeout(() => {
        setShowFormModal(false);
        setLoading(false);
      }, 3000);

    } catch (error) {
      console.error(error);
      toast.error('Error adding credit');
      setLoading(false);
    }
  };

  const handleImageView = (imageBase64) => {
    setSelectedImage(imageBase64);
    setShowImageModal(true);
  };

  return (
    <div className="p-2 md:p-6 space-y-4 md:space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 md:gap-4 w-full">
        <div className="flex flex-col md:flex-row w-full gap-3">

          {/* Search + Add Button Row (Mobile grouping) */}
          <div className="flex items-end gap-2 w-full md:w-auto md:flex-1">
            <div className="flex-1 w-full">

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 md:top-2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Search all fields..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-lg md:rounded pl-8 pr-3 py-2 md:py-1.5 focus:outline-none focus:border-sky-500 text-sm"
                />
              </div>
            </div>
            {/* Mobile Add Button */}
            <button
              onClick={() => setShowFormModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center md:hidden h-[38px] w-[38px] flex-shrink-0 shadow-sm transition"
            >
              <Plus size={20} />
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:w-auto md:flex-1">
            <div>

              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg md:rounded px-2 md:px-3 py-2 md:py-1.5 focus:outline-none focus:border-sky-500 text-sm"
              />
            </div>
            <div>

              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg md:rounded px-2 md:px-3 py-2 md:py-1.5 focus:outline-none focus:border-sky-500 text-sm"
              />
            </div>
            <div>

              <select
                value={filters.personName}
                onChange={(e) => setFilters({ ...filters, personName: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg md:rounded px-2 md:px-3 py-2 md:py-1.5 focus:outline-none focus:border-sky-500 text-sm"
              >
                <option value="">All Persons</option>
                {Array.from(new Set(credits.map(c => c.personName))).map(person => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </div>
            <div>

              <select
                value={filters.mode}
                onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg md:rounded px-2 md:px-3 py-2 md:py-1.5 focus:outline-none focus:border-sky-500 text-sm"
              >
                <option value="">All Modes</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Online">Online</option>
              </select>
            </div>
          </div>
        </div>

        {/* Desktop Add Button */}
        <button
          onClick={() => setShowFormModal(true)}
          className="hidden md:flex bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 md:h-[34px] rounded-lg font-semibold items-center justify-center gap-2 transition shadow-sm w-full md:w-auto mt-2 md:mt-0 flex-shrink-0"
        >
          <Plus size={18} />
          Add Credit
        </button>
      </div>

      {/* Form Section Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Credit Entry Form</h2>
              <button type="button" onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 md:p-5 overflow-y-auto flex-1">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Person Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Person Name *
                    </label>
                    <input
                      type="text"
                      value={formData.personName}
                      onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                      placeholder="Enter person name"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      required
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      required
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Credit Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      required
                    />
                  </div>

                  {/* Payment Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Mode *
                    </label>
                    <select
                      value={formData.paymentMode}
                      onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Online">Online</option>
                    </select>
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks
                  </label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Add any remarks..."
                    rows="3"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Image (Optional)
                  </label>
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-sky-400 hover:bg-sky-50 transition flex flex-col items-center justify-center cursor-pointer"
                    >
                      <Upload className="text-gray-400 mb-2" size={28} />
                      <span className="text-sm font-medium text-gray-700">
                        Click to upload or drag and drop
                      </span>
                      <span className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 2MB</span>
                    </button>

                    {imagePreview && (
                      <div className="mt-4">
                        <div className="relative inline-block">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="h-40 w-40 object-cover rounded border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setImage(null);
                              setImagePreview('');
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-2 px-6 rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {loading ? 'Adding Credit...' : 'Add Credit'}
                  </button>
                  <button
                    type="reset"
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                  >
                    Reset
                  </button>
                </div>

                <p className="text-xs text-gray-500 bg-blue-50 p-3 rounded border border-blue-200">
                  ℹ️ Credits are auto-approved and will be reflected in the ledger immediately.
                </p>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* List Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col mt-4">
        {/* Mobile View: Cards */}
        <div className="md:hidden flex flex-col gap-2 p-2 overflow-y-auto h-[calc(100vh-380px)] min-h-[250px] bg-slate-50/50 pb-2">
          {paginatedCredits.map((credit) => (
            <div key={credit.id} className="bg-white rounded-xl border border-indigo-50 shadow-[0_2px_10px_-4px_rgba(79,70,229,0.1)] p-2.5 relative flex flex-col gap-2 transition-all">
              {/* Top Row: SN and Badge */}
              <div className="flex justify-between items-center mb-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-medium text-[10px] shadow-inner flex-shrink-0">
                    {credit.sn.split('-')[1] || credit.sn.slice(-2)}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-[13px] uppercase tracking-tight leading-tight">
                      {credit.personName}
                    </h3>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-medium text-emerald-600 text-[15px] tracking-tight">{formatCurrency(credit.amount)}</span>
                  <div className="bg-sky-100/80 text-sky-700 px-1.5 rounded text-[8px] font-medium tracking-widest uppercase mt-1">
                    {credit.paymentMode}
                  </div>
                </div>
              </div>

              {/* Remarks Box */}
              <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-lg p-2 border border-slate-100">
                <div className="flex items-center gap-1 mb-1 border-b border-slate-200/60 pb-1">
                  <Calendar size={11} className="text-indigo-400" />
                  <span className="text-[10px] font-medium text-slate-700 tracking-tight">{formatDate(credit.date)}</span>
                  <span className="text-[9px] text-slate-400 font-medium ml-auto tracking-wider">REF: {credit.sn}</span>
                </div>
                <div>
                  <p className="text-[9px] text-indigo-500 font-medium mb-0 uppercase tracking-wider">Remarks</p>
                  <p className="text-slate-700 text-[11px] leading-snug font-normal">{credit.remarks || 'No remarks provided.'}</p>
                </div>
              </div>

              {/* View Image Action */}
              {credit.image && (
                <div className="mt-1 flex justify-end">
                  <button onClick={() => handleImageView(credit.image)} className="text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors w-full justify-center">
                    <Eye size={12} strokeWidth={2} /> View Attached Receipt
                  </button>
                </div>
              )}
            </div>
          ))}

          {filteredCredits.length === 0 && (
            <div className="p-4 text-center text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm font-medium text-xs">
              No entries found.
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto overflow-y-auto h-[calc(108vh-300px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full min-w-[800px] relative">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">SN</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Person</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Date</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Amount</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Payment Mode</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Image</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCredits.map((credit) => (
                <tr key={credit.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-center text-sm text-gray-900 font-medium">{credit.sn}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">{credit.personName}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700 whitespace-nowrap">{formatDate(credit.date)}</td>
                  <td className="px-4 py-3 text-center text-sm font-bold text-emerald-600">
                    {formatCurrency(credit.amount)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">{credit.paymentMode}</td>
                  <td className="px-4 py-3 text-center text-sm">
                    {credit.image ? (
                      <button
                        onClick={() => handleImageView(credit.image)}
                        className="mx-auto text-sky-600 hover:text-sky-800 flex items-center justify-center gap-1"
                      >
                        <Eye size={16} /> View
                      </button>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-left text-sm text-gray-500 max-w-xs truncate">
                    {credit.remarks || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCredits.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No entries found.
            </div>
          )}
        </div>

        {/* Footer & Pagination Controls */}
        <div className="px-2 md:px-4 py-2 border-t border-gray-200 bg-gray-50 flex flex-col lg:flex-row items-center justify-between gap-2 lg:gap-4 rounded-b-lg pb-2 md:pb-3">

          {/* Mobile Totals Row */}
          {paginatedCredits.length > 0 && (
            <div className="flex w-full lg:w-auto justify-between lg:hidden items-center text-xs border-b border-gray-200 pb-2 mb-1 px-1">
              <div className="flex flex-col"><span className="text-gray-500 text-[9px] uppercase font-medium tracking-wider mb-0.5">Page Total</span> <span className="font-medium text-emerald-600 text-[13px]">{formatCurrency(pageTotalAmount)}</span></div>
              <div className="flex flex-col text-right"><span className="text-gray-500 text-[9px] uppercase font-medium tracking-wider mb-0.5">Total Filtered</span> <span className="font-medium text-gray-900 text-[13px]">{formatCurrency(totalAmount)}</span></div>
            </div>
          )}

          {/* Desktop Totals (Hidden on Mobile) */}
          {paginatedCredits.length > 0 && (
            <div className="hidden lg:flex items-center gap-6 text-sm order-2">
              <div><span className="text-gray-600">Page Total:</span> <span className="font-semibold text-emerald-600 ml-1">{formatCurrency(pageTotalAmount)}</span></div>
              <div className="w-px h-4 bg-gray-300"></div>
              <div><span className="text-gray-500 text-xs mr-1">Filtered Total:</span> <span className="font-semibold text-gray-900">{formatCurrency(totalAmount)}</span></div>
            </div>
          )}

          {/* Controls Row */}
          <div className="flex w-full lg:w-auto justify-between items-center order-3 lg:order-1 gap-2">
            <div className="text-[10px] md:text-sm text-gray-600 flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-md px-1 flex-shrink-0 md:px-2 py-1 focus:outline-none focus:border-indigo-500 bg-white font-medium text-[10px] md:text-sm shadow-sm"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-[10px] md:text-sm text-gray-500 whitespace-nowrap ml-1 font-medium">
                {filteredCredits.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}-{Math.min(currentPage * itemsPerPage, sortedCredits.length)} of {sortedCredits.length}
              </span>
            </div>

            <div className="flex gap-1.5 md:gap-2 justify-end items-center flex-shrink-0 text-gray-700">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 md:px-2 md:py-1 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition shadow-sm flex items-center justify-center text-indigo-600"
                title="Previous Page"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
              <div className="flex items-center text-[10px] md:text-sm font-medium whitespace-nowrap text-gray-500">
                Pg {currentPage}/{totalPages || 1}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1 md:px-2 md:py-1 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition shadow-sm flex items-center justify-center text-indigo-600"
                title="Next Page"
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Image Preview</h3>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <img src={selectedImage} alt="Credit" className="w-full rounded" />
          </div>
        </div>
      )}
    </div>
  );
}
