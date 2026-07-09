import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../AuthContext";
import { auth, db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { BookOpen, Calendar, MonitorPlay, Presentation, LogOut, Home, Bell, Search, Settings, Shield, Library, ChevronDown, Image, HelpCircle, X, Compass, FileText, Sparkles, Download, Coins, PlusCircle, AlertCircle, Loader2, FlaskConical, Cpu, BrainCircuit } from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import { AnimatePresence, motion } from "motion/react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, userProfile, isAdmin } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("50000");
  const [billImage, setBillImage] = useState<string | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rechargeSuccess, setRechargeSuccess] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  useEffect(() => {
    if (showRechargeModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showRechargeModal]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    }, (error) => {
      console.error("Lỗi đếm thông báo chưa đọc:", error);
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogout = () => {
    auth.signOut();
  };

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;
    
    const amountNum = Number(rechargeAmount);
    if (isNaN(amountNum) || amountNum < 10000) {
      alert("Số tiền nạp tối thiểu là 10,000đ!");
      return;
    }

    if (!billImage) {
      alert("Vui lòng tải lên ảnh chụp màn hình chuyển khoản (Bill)!");
      return;
    }

    setIsSubmitting(true);
    try {
      const txRef = await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        userEmail: user.email,
        userName: userProfile.name || "Giáo viên",
        amount: amountNum,
        type: "deposit",
        status: "pending",
        imageUrl: billImage,
        createdAt: serverTimestamp()
      });
      
      try {
        await fetch("/api/telegram/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail: user.email,
            userName: userProfile.name || "Giáo viên",
            packageLabel: "Nạp Coin",
            price: amountNum.toLocaleString() + "đ",
            imageUrl: billImage,
            transactionId: txRef.id
          })
        });
      } catch (e) {
        console.error("Telegram notification error:", e);
      }
      
      setRechargeSuccess(true);
      setTimeout(() => {
        setShowRechargeModal(false);
        setRechargeSuccess(false);
        setBillImage(null);
        setBillFile(null);
      }, 3000);
    } catch (e) {
      console.error("Lỗi gửi yêu cầu nạp coin:", e);
      alert("Đã xảy ra lỗi, vui lòng thử lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBillUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBillFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBillImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const navItems = [
    { name: "Tổng quan", path: "/dashboard", icon: <Home className="w-5 h-5" /> },
    { name: "Thư viện Mẫu", path: "/templates", icon: <Library className="w-5 h-5" /> },
    { name: "Soạn Giáo Án", path: "/tool/lesson_plan", icon: <BookOpen className="w-5 h-5" /> },
    { name: "Lập Kế Hoạch", path: "/tool/plan", icon: <Calendar className="w-5 h-5" /> },
    { name: "Chuyển Đổi Số", path: "/tool/digital", icon: <MonitorPlay className="w-5 h-5" /> },
    { name: "AI Video", path: "/tool/video", icon: <Presentation className="w-5 h-5" /> },
    { name: "Tạo Infographic", path: "/infographic-maker", icon: <Image className="w-5 h-5" /> },
  ];

  if (isAdmin) {
    navItems.push({ name: "Admin", path: "/admin", icon: <Shield className="w-5 h-5" /> });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar - Fixed */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 fixed top-0 left-0 right-0 z-50">
        <Link to="/" title="Về trang chủ" className="flex items-center gap-3 group">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-700 transition-colors">
            <BookOpen className="text-white h-4 w-4" />
          </div>
          <span className="font-bold text-xl text-slate-900 tracking-tight hidden sm:block group-hover:text-blue-700 transition-colors">EduCreate</span>
        </Link>
        
        {/* Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
              placeholder="Tìm kiếm tài nguyên..."
            />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">
            Trang chủ
          </Link>

          {user && (
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-full pl-3 pr-1 py-1 shadow-sm relative group/coins">
              <div className="flex items-center gap-1.5 mr-2">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-700">{(userProfile?.coins || 0).toLocaleString()}</span>
              </div>
              <button 
                onClick={() => setShowRechargeModal(true)}
                className="w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                title="Nạp thêm Coin"
              >
                <PlusCircle className="w-4 h-4" />
              </button>

              {/* Coin usage explanation tooltip */}
              <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-xl shadow-2xl border border-amber-100 p-4 opacity-0 invisible group-hover/coins:opacity-100 group-hover/coins:visible transition-all z-[60] pointer-events-none">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Coin để làm gì?</h4>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-[11px] text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0"></div>
                    <span>Dùng để tạo <strong>AI Video</strong> bài giảng (2,000 coin/lượt).</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0"></div>
                    <span>Mua các tài liệu chất lượng cao tại <strong>Chợ Ký Gửi</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0"></div>
                    <span>Gói Free: Dùng Coin để mở khóa các tính năng giới hạn.</span>
                  </li>
                </ul>
                <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 italic">
                  * Tỉ lệ quy đổi: 1 VNĐ = 1 Coin
                </div>
              </div>
            </div>
          )}

          <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>
          
          <div className="relative" ref={notificationRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              title="Thông báo" 
              className={`transition-colors relative p-1.5 rounded-lg block cursor-pointer ${showNotifications ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-extrabold text-white ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute top-full right-0 mt-3 w-[360px] max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[70] overflow-hidden flex flex-col h-[500px] max-h-[80vh]"
                >
                  <NotificationsPanel onClose={() => setShowNotifications(false)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>
          <div className="relative">
            <div 
              className="flex items-center gap-2 cursor-pointer group hover:bg-slate-50 px-2 py-1.5 rounded-lg transition-colors"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              {userProfile?.avatar ? (
                <img 
                  src={userProfile.avatar} 
                  alt="Avatar" 
                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold border border-slate-200 group-hover:border-blue-300 transition-colors">
                  {userProfile?.name?.[0] || user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <span className="text-sm font-medium text-slate-700 hidden sm:block group-hover:text-slate-900 transition-colors">
                {userProfile?.name || user?.displayName || "Giáo viên"}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </div>

            {showProfileMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowProfileMenu(false)}
                ></div>
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 animate-fade-in origin-top-right">
                  <Link 
                    to="/profile" 
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <Settings className="w-4 h-4" />
                    Cài đặt tài khoản
                  </Link>
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
 
      <div className="flex-1 flex pt-16 h-screen overflow-hidden">
        {/* Sidebar - Fixed on desktop */}
        <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden md:flex fixed left-0 top-16 bottom-0 z-40 overflow-y-auto custom-scrollbar">
          <div className="p-4 flex-1 flex flex-col">
            <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 shrink-0">Menu chính</p>
            <nav className="space-y-1 overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link 
                    key={item.path} 
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive 
                        ? "bg-blue-50 text-blue-700 font-semibold" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className={`${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                      {item.icon}
                    </div>
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="p-4 border-t border-slate-200 shrink-0">
            <button 
              onClick={() => setShowHelpModal(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left cursor-pointer mb-1"
            >
              <HelpCircle className="w-5 h-5 text-slate-400" />
              <span>Hướng dẫn sử dụng</span>
            </button>
            <Link to="/profile" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
              <Settings className="w-5 h-5 text-slate-400" />
              Cài đặt
            </Link>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors mt-1"
            >
              <LogOut className="w-5 h-5 text-slate-400" />
              Đăng xuất
            </button>
          </div>
        </aside>
        
        {/* Main Content - Padded for sidebar with independent scroll */}
        <main className="flex-1 md:ml-64 bg-slate-50 p-4 sm:p-8 overflow-y-auto h-full">
          <div className="font-sans max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Nav Header */}
      <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm fixed top-0 w-full z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="text-white h-4 w-4" />
          </div>
          <span className="font-bold text-lg text-slate-900 tracking-tight">EduCreate</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowHelpModal(true)}
            className="text-slate-500 hover:text-blue-600 transition-colors p-1"
            title="Hướng dẫn sử dụng"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <button onClick={handleLogout} className="text-slate-500 hover:text-red-600 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Hướng dẫn sử dụng Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5 font-bold text-slate-900 text-lg">
                <HelpCircle className="w-5.5 h-5.5 text-blue-600" />
                <span>Hướng dẫn sử dụng EduCreate</span>
              </div>
              <button 
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              <p className="text-sm text-slate-600 leading-relaxed">
                Chào mừng quý thầy cô đến với <strong className="text-blue-600">EduCreate</strong> - Trợ lý AI thiết kế bài giảng và kế hoạch giảng dạy chuyên nghiệp! Chỉ với vài bước đơn giản, thầy cô sẽ sở hữu ngay các tài liệu giảng dạy tối ưu chuẩn sư phạm.
              </p>

              {/* Steps */}
              <div className="space-y-5">
                {/* Step 1 */}
                <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950 text-sm mb-1">Bước 1: Chọn Tính Năng Cần Tạo</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Lựa chọn một trong các tính năng chuyên nghiệp tại menu bên trái: <strong className="text-slate-800">Soạn Giáo Án</strong> (theo mẫu/chuẩn), <strong className="text-slate-800">Lập Kế Hoạch</strong> (phân phối chương trình), <strong className="text-slate-800">AI Video / Thiết kế bài học</strong>, hoặc <strong className="text-slate-800">Tạo Infographic</strong> trực quan sinh động.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950 text-sm mb-1">Bước 2: Nhập Thông Tin & Tải Tài Liệu</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Điền chủ đề, yêu cầu bài dạy, lựa chọn khối lớp/môn học. Thầy cô có thể tải lên tệp tài liệu tham khảo (.docx, hình ảnh, văn bản giáo trình) để AI phân tích chuẩn xác theo chương trình học của mình.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950 text-sm mb-1">Bước 3: Chạy Luồng Phân Tích AI</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Nhấn nút <strong className="text-purple-700">"Chạy luồng xử lý AI"</strong> hoặc <strong className="text-purple-700">"Tạo Infographic"</strong>. Hệ thống AI EduCreate sẽ lập tức thiết kế khung sườn, soạn thảo nội dung khoa học và tối ưu cấu trúc sư phạm trong tích tắc.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950 text-sm mb-1">Bước 4: Xem Trước, Lưu Trữ & Xuất Bản</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Xem trực quan kết quả sinh động trên bảng xem trước. Thầy cô có thể lưu bài giảng vào tài khoản cá nhân, hoặc dễ dàng tải về máy dưới định dạng file <strong className="text-emerald-700">Word (DOC)</strong>, file thuyết trình <strong className="text-emerald-700">PowerPoint (PPT)</strong> hay định dạng <strong className="text-emerald-700">ảnh Infographic sắc nét</strong> để dùng ngay.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mẹo nhỏ */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
                <span className="font-semibold block mb-1 text-blue-950">💡 Mẹo nhỏ cho Thầy Cô:</span>
                Yêu cầu nhập càng chi tiết (nêu rõ thời lượng tiết học, năng lực cần đạt, hoạt động cặp đôi/nhóm...) kết hợp với tài liệu đính kèm sẽ giúp AI tạo ra giáo án chất lượng cao và đúng chuẩn mong muốn nhất!
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-xs sm:text-sm shadow-md shadow-blue-100 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                Đã hiểu, Bắt đầu ngay!
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Recharge Coin Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[95vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2.5 font-bold text-slate-900 text-lg">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 border border-amber-200">
                  <Coins className="w-6 h-6" />
                </div>
                <span>Nạp Coin vào tài khoản</span>
              </div>
              <button 
                onClick={() => setShowRechargeModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto">
              {rechargeSuccess ? (
                <div className="p-12 flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Yêu cầu đã được gửi!</h3>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-sm">
                    Quản trị viên đang phê duyệt yêu cầu nạp coin của bạn. Coin sẽ được cộng vào ví sau khi giao dịch được xác nhận (thường từ 5-30 phút).
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRecharge} className="p-6 space-y-5">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Thông tin thanh toán (Admin)
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-[11px]">
                    <div>
                      <p className="text-blue-500 font-medium">Chủ tài khoản:</p>
                      <p className="font-bold text-blue-950 uppercase">DO VAN DOAN</p>
                    </div>
                    <div>
                      <p className="text-blue-500 font-medium">Ngân hàng:</p>
                      <p className="font-bold text-blue-950">MB BANK</p>
                    </div>
                    <div>
                      <p className="text-blue-500 font-medium">Số tài khoản:</p>
                      <p className="font-bold text-blue-950 text-sm">9666989889</p>
                    </div>
                    <div>
                      <p className="text-blue-500 font-medium">Nội dung CK:</p>
                      <p className="font-bold text-blue-950 uppercase">NAPCOIN {user?.email?.split('@')[0].toUpperCase()}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-2xl border-2 border-slate-50 shadow-md flex flex-col items-center gap-3 w-full group transition-all hover:shadow-lg">
                    <div className="w-full text-center">
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-amber-200">
                        Mã VietQR nạp tiền nhanh
                      </span>
                    </div>
                    <div className="relative">
                      <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-amber-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                      <div className="relative bg-white p-2 rounded-xl border border-slate-100">
                        <img 
                          src={`https://img.vietqr.io/image/MB-9666989889-compact2.png?amount=${rechargeAmount}&addInfo=${encodeURIComponent(`NAPCOIN ${user?.email?.split('@')[0].toUpperCase()}`)}&accountName=DO%20VAN%20DOAN`} 
                          alt="VietQR Recharge"
                          className="w-44 h-44 object-contain"
                        />
                      </div>
                    </div>
                    <div className="w-full bg-slate-50 rounded-lg p-2 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Số tiền:</span>
                      <span className="text-xs font-black text-slate-700">{(Number(rechargeAmount) || 0).toLocaleString()}đ</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Số tiền nạp (VNĐ)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        min="10000"
                        step="1000"
                        value={rechargeAmount}
                        onChange={(e) => setRechargeAmount(e.target.value)}
                        placeholder="Nhập số tiền (VD: 10000)"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                        required
                      />
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <span className="text-xs font-bold text-slate-400">đ</span>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[10px] text-slate-400 font-medium">Tối thiểu: <span className="text-amber-600 font-bold">10,000đ</span> (Tương đương 10,000 Coin)</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Ảnh chụp màn hình chuyển khoản (Bill) *</label>
                    <div className="relative group">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleBillUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        required
                      />
                      <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${billImage ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 hover:border-blue-400 bg-slate-50'}`}>
                        {billImage ? (
                          <div className="flex flex-col items-center gap-2">
                            <img src={billImage} alt="Bill Preview" className="h-32 rounded-lg shadow-md border border-white" />
                            <p className="text-[10px] text-emerald-600 font-bold uppercase">Đã tải ảnh lên thành công!</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 group-hover:text-blue-500 group-hover:scale-110 transition-transform">
                              <Download className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-slate-700">Tải ảnh Bill lên tại đây</p>
                              <p className="text-[10px] text-slate-500">Chấp nhận PNG, JPG, JPEG</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRechargeModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
                    {isSubmitting ? "Đang gửi..." : "Xác nhận nạp Coin"}
                  </button>
                </div>
              </form>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
