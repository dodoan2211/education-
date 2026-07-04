import { useState, useEffect } from "react";
import { db } from "../firebase";
import { useToast } from "../context/ToastContext";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, setDoc, addDoc, onSnapshot, increment } from "firebase/firestore";
import { Check, X, Loader2, Info, Coins, Zap } from "lucide-react";
import { Transaction } from "../types";

export default function AdminTransactions() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Transaction[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(items);
      setLoading(false);
    }, (error) => {
      console.error("Lỗi real-time giao dịch:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const pendingIds = transactions.filter(tx => tx.status === 'pending').map(tx => tx.id);
    if (selectedIds.length === pendingIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingIds);
    }
  };

  const handleBulkApprove = async () => {
    setBulkProcessing(true);
    try {
      for (const id of selectedIds) {
        const tx = transactions.find(t => t.id === id);
        if (tx && tx.status === 'pending') {
          await processApprove(tx, true); // Silent mode for bulk
        }
      }
      setSelectedIds([]);
      toast.success(`Đã duyệt thành công ${selectedIds.length} giao dịch!`);
    } catch (error) {
      console.error("Lỗi duyệt hàng loạt:", error);
      toast.error("Gặp lỗi khi xử lý hàng loạt.");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    setBulkProcessing(true);
    try {
      for (const id of selectedIds) {
        const tx = transactions.find(t => t.id === id);
        if (tx && tx.status === 'pending') {
          await processReject(tx, true); // Silent mode for bulk
        }
      }
      setSelectedIds([]);
      toast.success(`Đã từ chối ${selectedIds.length} giao dịch.`);
    } catch (error) {
      console.error("Lỗi từ chối hàng loạt:", error);
      toast.error("Gặp lỗi khi xử lý hàng loạt.");
    } finally {
      setBulkProcessing(false);
    }
  };

  const processApprove = async (tx: Transaction, silent = false) => {
    if (!tx.userId) return;
    
    // 1. Update transaction status
    await updateDoc(doc(db, "transactions", tx.id), {
      status: "approved",
      processedAt: serverTimestamp()
    });

    if (tx.type === 'deposit') {
      const amount = Number(tx.amount || 0);
      await setDoc(doc(db, "users", tx.userId), {
        coins: increment(amount)
      }, { merge: true });

      await addDoc(collection(db, "notifications"), {
        userId: tx.userId,
        type: "general",
        title: "Nạp Coin thành công!",
        message: `Bạn đã được cộng ${amount.toLocaleString()} Coin vào tài khoản.`,
        createdAt: serverTimestamp(),
        read: false
      });
    } else {
      const date = new Date();
      const days = Number(tx.days || 30);
      date.setDate(date.getDate() + days);
      
      await setDoc(doc(db, "users", tx.userId), {
        package: tx.packageKey || 'pro',
        expiresAt: date.toISOString(),
        usageCount: 0
      }, { merge: true });

      await addDoc(collection(db, "notifications"), {
        userId: tx.userId,
        type: "system",
        title: "Giao dịch đã được duyệt!",
        message: `Yêu cầu kích hoạt gói ${tx.packageLabel} của bạn đã được duyệt thành công. Hạn sử dụng đến ngày ${date.toLocaleDateString('vi-VN')}.`,
        createdAt: serverTimestamp(),
        read: false
      });
    }
  };

  const processReject = async (tx: Transaction, silent = false) => {
    if (!tx.userId) return;
    await updateDoc(doc(db, "transactions", tx.id), {
      status: "rejected",
      processedAt: serverTimestamp()
    });

    await addDoc(collection(db, "notifications"), {
      userId: tx.userId,
      type: "system",
      title: "Giao dịch bị từ chối",
      message: `Giao dịch ${tx.type === 'deposit' ? 'nạp Coin' : 'kích hoạt gói'} của bạn đã bị từ chối. Vui lòng liên hệ quản trị viên.`,
      createdAt: serverTimestamp(),
      read: false
    });
  };

  const handleApprove = async (tx: Transaction) => {
    if (!tx.userId) {
      toast.error("Lỗi: Giao dịch không chứa thông tin người dùng (userId)!");
      return;
    }
    
    setProcessingId(tx.id);
    try {
      await processApprove(tx);
      toast.success(`Đã duyệt giao dịch thành công cho ${tx.userName}!`);
    } catch (error: any) {
      console.error("Lỗi khi duyệt:", error);
      toast.error("Đã xảy ra lỗi khi duyệt giao dịch!");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (tx: Transaction) => {
    if (!tx.userId) {
      toast.error("Lỗi: Giao dịch không chứa thông tin người dùng (userId)!");
      return;
    }

    setProcessingId(tx.id);
    try {
      await processReject(tx);
      toast.success(`Đã từ chối giao dịch của ${tx.userName} thành công.`);
    } catch (error: any) {
      console.error("Lỗi khi từ chối:", error);
      toast.error("Đã xảy ra lỗi khi từ chối giao dịch!");
    } finally {
      setProcessingId(null);
    }
  };

  // Handle URL auto-approve
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const txIdToApprove = urlParams.get('approve_tx');
    const txIdToReject = urlParams.get('reject_tx');
    
    if (txIdToApprove && transactions.length > 0 && !processingId) {
      const tx = transactions.find(t => t.id === txIdToApprove);
      if (tx && tx.status === 'pending') {
        handleApprove(tx);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      }
    } else if (txIdToReject && transactions.length > 0 && !processingId) {
      const tx = transactions.find(t => t.id === txIdToReject);
      if (tx && tx.status === 'pending') {
        handleReject(tx);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      }
    }
  }, [transactions]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-slate-800 text-lg">Quản lý giao dịch</h2>
          {transactions.filter(tx => tx.status === 'pending').length > 0 && (
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={selectedIds.length > 0 && selectedIds.length === transactions.filter(tx => tx.status === 'pending').length}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chọn tất cả</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
              <span className="text-xs font-bold text-blue-600 mr-2">Đã chọn {selectedIds.length}</span>
              <button
                onClick={handleBulkReject}
                disabled={bulkProcessing}
                className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-rose-100 transition-all flex items-center gap-1.5"
              >
                {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Từ chối ({selectedIds.length})
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={bulkProcessing}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-1.5"
              >
                {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Duyệt ({selectedIds.length})
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Live
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100 max-h-[800px] overflow-y-auto">
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Chưa có giao dịch nào.</div>
        ) : (
          transactions.map(tx => (
            <div key={tx.id} className={`p-4 flex flex-col md:flex-row gap-4 items-start md:items-center hover:bg-slate-50 transition-colors ${selectedIds.includes(tx.id) ? 'bg-blue-50/50' : ''}`}>
              {tx.status === 'pending' && (
                <div className="shrink-0 pt-1 md:pt-0">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(tx.id)}
                    onChange={() => handleToggleSelect(tx.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              )}
              <div className="w-24 h-24 bg-slate-100 rounded-lg overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center cursor-pointer group relative">
                {tx.imageUrl ? (
                  <img src={tx.imageUrl} alt="Bill" className="w-full h-full object-cover" onClick={() => window.open(tx.imageUrl, '_blank')} />
                ) : (
                  <span className="text-xs text-slate-400">No Image</span>
                )}
                {tx.imageUrl && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="text-white text-xs font-medium font-mono border border-white/30 px-2 py-1 rounded">View</span>
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-1">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    {tx.userName}
                    {tx.type === 'deposit' ? (
                      <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-amber-200">
                        <Coins className="w-2.5 h-2.5" /> Nạp Coin
                      </span>
                    ) : (
                      <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-blue-200">
                        <Zap className="w-2.5 h-2.5" /> Nâng cấp gói
                      </span>
                    )}
                  </h3>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 sm:mt-0 w-fit ${
                    tx.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    tx.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {tx.status === 'pending' ? 'Chờ duyệt' : tx.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}
                  </span>
                </div>
                <div className="text-sm text-slate-600 mb-1">{tx.userEmail}</div>
                <div className="text-sm font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded w-fit inline-block mb-1 border border-slate-200">
                  {tx.type === 'deposit' ? (
                    <span className="flex items-center gap-1">
                      Số lượng: <b className="text-amber-600">{(tx.amount || 0).toLocaleString()} Coin</b>
                    </span>
                  ) : (
                    <span>Gói: {tx.packageLabel} - {(tx.amount || 0).toLocaleString()}đ</span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Mã GD: {tx.id} &bull; {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString('vi-VN') : 'Unknown'}
                </div>
              </div>

              {tx.status === 'pending' && (
                <div className="flex gap-2 w-full md:w-auto shrink-0 mt-3 md:mt-0">
                  <button
                    onClick={() => handleReject(tx)}
                    disabled={processingId === tx.id}
                    className="flex-1 md:flex-none px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" /> Từ chối
                  </button>
                  <button
                    onClick={() => handleApprove(tx)}
                    disabled={processingId === tx.id}
                    className="flex-1 md:flex-none px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {processingId === tx.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Duyệt
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
