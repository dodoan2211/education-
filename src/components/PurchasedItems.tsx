import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { Download, FileText, Loader2 } from "lucide-react";
import { useToast } from "../context/ToastContext";

interface PurchasedItem {
  id: string;
  itemId: string;
  itemTitle: string;
  amount: number;
  createdAt: any;
  fileUrl: string | null;
}

export default function PurchasedItems() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<PurchasedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchPurchased = async () => {
      try {
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", user.uid),
          where("type", "==", "purchase")
        );
        const snap = await getDocs(q);
        const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchasedItem));
        fetched.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setItems(fetched);
      } catch (err) {
        console.error("Lỗi tải lịch sử mua tài liệu:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPurchased();
  }, [user]);

  const handleDownload = async (item: PurchasedItem) => {
    const downloadFile = (url: string, defaultName: string) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (item.fileUrl) {
      downloadFile(item.fileUrl, item.itemTitle || 'Tai_lieu');
      return;
    }
    
    setDownloadingId(item.id);
    try {
      const docRef = doc(db, "consignments", item.itemId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().fileUrl) {
        const data = docSnap.data();
        downloadFile(data.fileUrl, data.fileName || data.title || item.itemTitle || 'Tai_lieu');
      } else {
        toast.error("Không tìm thấy link tải cho tài liệu này.");
      }
    } catch (err) {
      toast.error("Lỗi khi tải tài liệu.");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 flex justify-center mt-6">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in mt-6">
      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" /> Lịch sử mua tài liệu
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Các tài liệu bạn đã mua. Nhấn để tải lại bất cứ lúc nào.
        </p>
      </div>
      <div className="p-6">
        {items.length === 0 ? (
          <p className="text-center text-slate-500 py-4">Bạn chưa mua tài liệu nào.</p>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-200 transition-colors">
                <div>
                  <h3 className="font-semibold text-slate-800">{item.itemTitle}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('vi-VN') : ""} • {item.amount.toLocaleString()} Coin
                  </p>
                </div>
                <button
                  onClick={() => handleDownload(item)}
                  disabled={downloadingId === item.id}
                  className={`p-2 rounded-lg transition-colors text-blue-600 bg-blue-50 hover:bg-blue-100`}
                  title="Tải xuống"
                >
                  {downloadingId === item.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
