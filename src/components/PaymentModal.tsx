import { useState, useRef, useEffect } from "react";
import { Loader2, BookOpen, Info, UploadCloud, X } from "lucide-react";
import { db, storage } from "../firebase";
import { useToast } from "../context/ToastContext";
import { doc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface PaymentModalProps {
  user: any;
  userProfile: any;
  selectedPackage: {
    key: string;
    label: string;
    price: string;
    days: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ user, userProfile, selectedPackage, onClose, onSuccess }: PaymentModalProps) {
  const { toast } = useToast();
  const [isPaying, setIsPaying] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmPayment = async () => {
    if (!user || !selectedPackage) return;
    if (!receiptFile) {
      toast.warning("Vui lòng tải lên ảnh biên lai chuyển khoản để hệ thống xác nhận.");
      return;
    }
    
    setIsPaying(true);
    try {
      // Use the base64 preview directly since Firebase Storage rules might block upload
      const imageUrl = receiptPreview;

      // 2. Save transaction to Firestore
      const txRef = await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email?.split('@')[0] || 'User',
        packageKey: selectedPackage.key,
        packageLabel: selectedPackage.label,
        amount: Number(selectedPackage.price.replace(/[^0-9]/g, '')),
        type: 'package',
        days: selectedPackage.days,
        imageUrl,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // 3. Notify user that it's pending
      await addDoc(collection(db, "notifications"), {
        userId: user.uid,
        type: "system",
        title: "Đã nhận yêu cầu nâng cấp",
        message: `Hệ thống đã ghi nhận yêu cầu nâng cấp gói ${selectedPackage.label} của thầy cô. Chúng tôi sẽ duyệt trong thời gian sớm nhất (tối đa 24h).`,
        createdAt: serverTimestamp(),
        read: false
      });

      // 4. Send to Telegram
      try {
        await fetch("/api/telegram/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail: user.email,
            userName: user.displayName || user.email?.split('@')[0] || 'User',
            packageLabel: selectedPackage.label,
            price: selectedPackage.price,
            imageUrl,
            transactionId: txRef.id
          })
        });
      } catch (e) {
        console.error("Failed to notify telegram", e);
      }

      toast.success("Yêu cầu nâng cấp gói đã được gửi thành công! Quản trị viên đang xử lý giao dịch.");
      onSuccess();
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Có lỗi xảy ra khi xử lý yêu cầu. Vui lòng thử lại sau.");
      setIsPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up flex flex-col my-auto max-h-[95vh]">
        <div className="p-6 text-center bg-blue-600 relative shrink-0">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">Kích hoạt Gói Cước</h2>
          <p className="text-blue-100 text-sm">Thanh toán qua quét mã QR tiện lợi</p>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-3 mb-6 items-start">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 leading-relaxed">
              <p className="font-bold">Gói dịch vụ đã chọn:</p>
              <p className="text-sm font-semibold mt-1 text-blue-900">{selectedPackage.label} - Giá cước: {selectedPackage.price}</p>
            </div>
          </div>

            <div className="w-full flex justify-center mb-4">
              <div className="bg-white border-2 border-slate-100 shadow-md rounded-2xl p-4 flex flex-col items-center gap-3 w-full">
                <div className="w-full text-center">
                  <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                    VIETQR THANH TOÁN TỰ ĐỘNG
                  </span>
                </div>
                
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative bg-white p-2 rounded-xl border border-slate-100 shadow-lg">
                    <img 
                      src={`https://img.vietqr.io/image/MB-9666989889-compact2.png?amount=${selectedPackage.price.replace(/[^0-9]/g, '')}&addInfo=${encodeURIComponent(`EDUCREATE ${user?.email?.split('@')[0]?.toUpperCase() || "USER"} ${selectedPackage.key.toUpperCase()}`)}&accountName=DO%20VAN%20DOAN`} 
                      alt="VietQR Payment"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                </div>

                <div className="w-full space-y-2 mt-2 px-2">
                  <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số tiền thanh toán</span>
                    <span className="text-sm font-black text-blue-600">{selectedPackage.price}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nội dung chuyển khoản</span>
                    <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-100 select-all cursor-pointer" title="Click để sao chép">
                      {`EDUCREATE ${user?.email?.split('@')[0]?.toUpperCase() || "USER"} ${selectedPackage.key.toUpperCase()}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full space-y-2.5 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Ngân hàng:</span>
                <span className="text-slate-900 font-bold">MB Bank</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Số tài khoản:</span>
                <span className="text-slate-900 font-mono font-bold select-all cursor-pointer hover:text-blue-600 flex items-center gap-1">
                  9666989889
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Chủ tài khoản:</span>
                <span className="text-slate-900 font-bold uppercase text-[10px]">DO VAN DOAN</span>
              </div>
            </div>

          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-800 mb-2">Tải lên biên lai chuyển khoản <span className="text-red-500">*</span></p>
            {!receiptPreview ? (
              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm font-medium text-slate-600">Nhấn để tải lên ảnh biên lai</p>
                <p className="text-xs text-slate-400 mt-1">Hỗ trợ JPG, PNG</p>
              </div>
            ) : (
              <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-100 h-40 flex items-center justify-center group">
                <img src={receiptPreview} alt="Receipt preview" className="max-h-full max-w-full object-contain" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => {
                      setReceiptFile(null);
                      setReceiptPreview(null);
                    }}
                    className="p-2 bg-white/20 hover:bg-red-500 text-white rounded-full backdrop-blur-sm transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            Sau khi chuyển khoản, vui lòng tải ảnh biên lai và bấm <b>"Gửi yêu cầu xác thực"</b>. Quản trị viên sẽ duyệt trong thời gian sớm nhất.
          </p>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors"
            disabled={isPaying}
          >
            Hủy bỏ
          </button>
          <button 
            onClick={handleConfirmPayment}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            disabled={isPaying || !receiptFile}
          >
            {isPaying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...
              </>
            ) : (
              <>
                Gửi yêu cầu xác thực
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
