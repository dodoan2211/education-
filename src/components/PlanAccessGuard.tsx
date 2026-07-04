import { useState } from "react";
import { useAuth } from "../AuthContext";
import { useToast } from "../context/ToastContext";
import { db } from "../firebase";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ShieldAlert, Sparkles, Plus, Check, Info, Loader2, BookOpen, Lock } from "lucide-react";
import Layout from "./Layout";
import PaymentModal from "./PaymentModal";

interface PlanAccessGuardProps {
  children: React.ReactNode;
  hasResult?: boolean;
  isGenerating?: boolean;
  noLayout?: boolean;
}

export default function PlanAccessGuard({
  children,
  hasResult = false,
  isGenerating = false,
  noLayout = false
}: PlanAccessGuardProps) {
  const { user, userProfile, loading } = useAuth();
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<{
    key: string;
    label: string;
    price: string;
    days: number;
  } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  if (loading) {
    if (noLayout) {
      return (
        <div className="flex flex-col items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <p className="text-xs font-semibold text-slate-500">Đang kiểm tra quyền truy cập...</p>
        </div>
      );
    }
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-500">Đang kiểm tra quyền truy cập hệ thống...</p>
        </div>
      </div>
    );
  }

  // Admin bypass
  if (user?.email === "dodoan2211@gmail.com") {
    return <>{children}</>;
  }

  const currentPackage = userProfile?.package || "free";
  const usageCount = userProfile?.usageCount || 0;
  const expiresAt = userProfile?.expiresAt || null;
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

  const isTrialLimitReached = currentPackage === "free" && usageCount >= 2;
  const isAccessBlocked = (isTrialLimitReached || isExpired) && !hasResult && !isGenerating;

  const handleConfirmPayment = async () => {
    if (!user || !selectedPackage) return;
    setIsPaying(true);
    try {
      const days = selectedPackage.days;
      const date = new Date();
      date.setDate(date.getDate() + days);
      
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, {
        package: selectedPackage.key,
        expiresAt: date.toISOString(),
        usageCount: 0 // reset usage count on upgrade
      }, { merge: true });

      await addDoc(collection(db, "notifications"), {
        userId: user.uid,
        type: "system",
        title: "Kích hoạt gói dịch vụ thành công!",
        message: `Hệ thống đã phê duyệt kích hoạt gói ${selectedPackage.label} (${days} ngày). Hạn dùng đến ngày ${date.toLocaleDateString('vi-VN')}. Chúc thầy cô có những trải nghiệm soạn thảo học liệu tuyệt vời nhất cùng EduCreate!`,
        createdAt: serverTimestamp(),
        read: false
      });

      setPaymentSuccess(true);
      toast.success("Nâng cấp và kích hoạt gói dịch vụ thành công!");
      setTimeout(() => {
        setSelectedPackage(null);
        setPaymentSuccess(false);
        window.location.reload(); // Refresh to update AuthContext and grant access
      }, 3000);
    } catch (err) {
      console.error("Lỗi nâng cấp gói cước:", err);
      toast.error("Đã xảy ra lỗi khi thực hiện nâng cấp gói. Vui lòng thử lại sau.");
    } finally {
      setIsPaying(false);
    }
  };

  const renderModal = () => {
    if (!selectedPackage) return null;
    return (
      <PaymentModal
        user={user}
        userProfile={userProfile}
        selectedPackage={selectedPackage}
        onClose={() => setSelectedPackage(null)}
        onSuccess={() => {
          setPaymentSuccess(true);
          setTimeout(() => {
            setSelectedPackage(null);
            setPaymentSuccess(false);
          }, 3000);
        }}
      />
    );
  };

  const blockContent = (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 animate-fade-in text-slate-700">
      {/* Main Blocked Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-blue-500/5 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-indigo-500/5 blur-3xl"></div>
        
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center border border-amber-100 mx-auto mb-5 shadow-sm">
          <Lock className="w-8 h-8 animate-pulse" />
        </div>

        <h2 className="text-2xl font-black text-slate-950 tracking-tight mb-3">
          {isExpired ? "Gói Đăng Ký Đã Hết Hạn" : "Giới Hạn Lượt Dùng Thử"}
        </h2>
        
        <p className="text-slate-600 text-sm leading-relaxed max-w-lg mx-auto mb-6">
          {isExpired ? (
            <>
              Hệ thống ghi nhận gói cước cao cấp của thầy cô đã hết hạn sử dụng vào ngày{" "}
              <b className="text-slate-900 font-bold">
                {expiresAt ? new Date(expiresAt).toLocaleDateString("vi-VN") : "vừa qua"}
              </b>
              . Hãy thực hiện gia hạn để tiếp tục sử dụng trọn bộ tính năng thiết kế học liệu AI không giới hạn.
            </>
          ) : (
            <>
              Thầy cô đã sử dụng hết <b className="text-slate-900 font-bold">2 lượt dùng thử</b> tính năng soạn thảo học liệu thông minh miễn phí. Hãy nâng cấp tài khoản để tiếp tục đồng hành cùng EduCreate!
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 animate-bounce" /> EduCreate Premium
          </span>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold text-slate-950">Chọn Gói Cước Nâng Cấp Ngay</h3>
        <p className="text-xs text-slate-500 mt-1">Giao dịch mã hóa an toàn qua cổng quét QR MBBank tiện lợi</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Pro 1 Month */}
        <div className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 p-6 flex flex-col justify-between transition-all hover:shadow-md relative group text-left">
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Phổ thông</p>
            <h4 className="text-lg font-extrabold text-slate-950">Gói Pro - 1 Tháng</h4>
            <p className="text-slate-500 text-xs mt-1">Đầy đủ các tính năng soạn bài nâng cao với công cụ AI</p>
            <div className="my-5">
              <span className="text-3xl font-black text-slate-950">80.000đ</span>
              <span className="text-slate-400 text-xs font-medium"> / tháng</span>
            </div>
          </div>
          <button
            onClick={() => setSelectedPackage({ key: 'pro', label: '1 Tháng (Pro)', price: '80.000đ', days: 30 })}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Đăng ký ngay
          </button>
        </div>

        {/* Pro 3 Months - Best Value */}
        <div className="bg-white rounded-2xl border-2 border-blue-500 p-6 flex flex-col justify-between transition-all shadow-sm relative overflow-hidden group text-left">
          <div className="absolute top-0 right-0 bg-blue-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest">
            Tiết Kiệm 20k
          </div>
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Được khuyên dùng</p>
            <h4 className="text-lg font-extrabold text-slate-950">Gói Pro - 3 Tháng</h4>
            <p className="text-slate-500 text-xs mt-1">Giải pháp dài hạn thích hợp nhất cho kỳ học của thầy cô</p>
            <div className="my-5">
              <span className="text-3xl font-black text-slate-950">220.000đ</span>
              <span className="text-slate-400 text-xs font-medium"> / 3 tháng</span>
            </div>
          </div>
          <button
            onClick={() => setSelectedPackage({ key: 'pro', label: '3 Tháng (Pro)', price: '220.000đ', days: 90 })}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
          >
            Đăng ký ngay
          </button>
        </div>

        {/* Enterprise 1 Year */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 flex flex-col justify-between transition-all hover:shadow-md relative group text-left">
          <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest">
            Đỉnh Cao AI
          </div>
          <div>
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Doanh nghiệp / Trường học</p>
            <h4 className="text-lg font-extrabold text-indigo-950 flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-blue-600" /> Enterprise - 1 Năm
            </h4>
            <p className="text-indigo-800 text-xs mt-1 font-medium">Khai mở toàn bộ năng lực AI bao gồm khởi tạo Video Bài giảng</p>
            <div className="my-5">
              <span className="text-3xl font-black text-indigo-950">799.000đ</span>
              <span className="text-indigo-500 text-xs font-medium"> / năm</span>
            </div>
          </div>
          <button
            onClick={() => setSelectedPackage({ key: 'enterprise', label: '1 Năm (Enterprise)', price: '799.000đ', days: 365 })}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Nâng cấp Enterprise
          </button>
        </div>
      </div>
    </div>
  );

  if (isAccessBlocked) {
    if (noLayout) {
      return (
        <div className="relative">
          {blockContent}
          {renderModal()}
        </div>
      );
    }
    return (
      <Layout>
        {blockContent}
        {renderModal()}
      </Layout>
    );
  }

  return <>{children}</>;
}
