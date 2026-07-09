import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../AuthContext";
import { auth, db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { BookOpen, Calendar, MonitorPlay, Presentation, LogOut, Home, Bell, Search, Settings, Shield, Library, ChevronDown, Image, HelpCircle, X, Compass, FileText, Sparkles, Download, Heart } from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import { AnimatePresence, motion } from "motion/react";

function DonateQRCompact() {
  const qrUrl = `https://img.vietqr.io/image/MB-9666989889-compact2.png?amount=50000&addInfo=${encodeURIComponent("DONATE EDUCREATE")}&accountName=${encodeURIComponent("DO VAN DOAN")}`;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <img src={qrUrl} alt="Donate QR" className="w-28 h-28 object-contain rounded-xl border border-rose-100" />
      <p className="text-[10px] text-rose-600 font-semibold">Ủng hộ EduCreate</p>
      <p className="text-[9px] text-slate-400 text-center leading-tight">MB BANK · 9666989889<br/>DO VAN DOAN</p>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, userProfile, isAdmin } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showDonatePanel, setShowDonatePanel] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const donateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (donateRef.current && !donateRef.current.contains(event.target as Node)) {
        setShowDonatePanel(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleLogout = () => { auth.signOut(); };

  const navItems = [
    { name: "Tổng quan", path: "/dashboard", icon: <Home className="w-5 h-5" /> },
    { name: "Thư viện Mẫu", path: "/templates", icon: <Library className="w-5 h-5" /> },
    { name: "Soạn Giáo Án", path: "/tool/lesson_plan", icon: <BookOpen className="w-5 h-5" /> },
    { name: "Lập Kế Hoạch", path: "/tool/plan", icon: <Calendar className="w-5 h-5" /> },
    { name: "Chuyển Đổi Số", path: "/tool/digital", icon: <MonitorPlay className="w-5 h-5" /> },
    { name: "AI Video", path: "/tool/video", icon: <Presentation className="w-5 h-5" /> },
    { name: "Tạo Infographic", path: "/infographic-maker", icon: <Image className="w-5 h-5" /> },
  ];
  if (isAdmin) navItems.push({ name: "Admin", path: "/admin", icon: <Shield className="w-5 h-5" /> });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 fixed top-0 left-0 right-0 z-50">
        <Link to="/" title="Về trang chủ" className="flex items-center gap-3 group">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-700 transition-colors">
            <BookOpen className="text-white h-4 w-4" />
          </div>
          <span className="font-bold text-xl text-slate-900 tracking-tight hidden sm:block group-hover:text-blue-700 transition-colors">EduCreate</span>
        </Link>

        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input type="text" className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all" placeholder="Tìm kiếm tài nguyên..." />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">Trang chủ</Link>

          {/* Donate button */}
          <div className="relative" ref={donateRef}>
            <button
              onClick={() => setShowDonatePanel(!showDonatePanel)}
              title="Ủng hộ dự án"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 transition-colors text-xs font-bold cursor-pointer"
            >
              <Heart className="h-3.5 w-3.5 fill-rose-500" /> Donate
            </button>

            <AnimatePresence>
              {showDonatePanel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute top-full right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[70] p-5"
                >
                  <DonateQRCompact />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>

          <div className="relative" ref={notificationRef}>
            <button onClick={() => setShowNotifications(!showNotifications)} title="Thông báo" className={`transition-colors relative p-1.5 rounded-lg block cursor-pointer ${showNotifications ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-extrabold text-white ring-2 ring-white">{unreadCount}</span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute top-full right-0 mt-3 w-[360px] max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[70] overflow-hidden flex flex-col h-[500px] max-h-[80vh]">
                  <NotificationsPanel onClose={() => setShowNotifications(false)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>
          <div className="relative">
            <div className="flex items-center gap-2 cursor-pointer group hover:bg-slate-50 px-2 py-1.5 rounded-lg transition-colors" onClick={() => setShowProfileMenu(!showProfileMenu)}>
              {userProfile?.avatar ? (
                <img src={userProfile.avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold border border-slate-200 group-hover:border-blue-300 transition-colors">
                  {userProfile?.name?.[0] || user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <span className="text-sm font-medium text-slate-700 hidden sm:block group-hover:text-slate-900 transition-colors">{userProfile?.name || user?.displayName || "Giáo viên"}</span>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </div>

            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 animate-fade-in origin-top-right">
                  <Link to="/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => setShowProfileMenu(false)}>
                    <Settings className="w-4 h-4" /> Cài đặt tài khoản
                  </Link>
                  <button onClick={() => { setShowProfileMenu(false); handleLogout(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left">
                    <LogOut className="w-4 h-4" /> Đăng xuất
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex pt-16 h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden md:flex fixed left-0 top-16 bottom-0 z-40 overflow-y-auto custom-scrollbar">
          <div className="p-4 flex-1 flex flex-col">
            <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 shrink-0">Menu chính</p>
            <nav className="space-y-1 overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
                    <div className={`${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{item.icon}</div>
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-4 border-t border-slate-200 shrink-0">
            {/* Donate QR in sidebar */}
            <div className="mb-3 p-3 bg-rose-50 rounded-xl border border-rose-100 flex flex-col items-center gap-2">
              <DonateQRCompact />
            </div>
            <button onClick={() => setShowHelpModal(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left cursor-pointer mb-1">
              <HelpCircle className="w-5 h-5 text-slate-400" /> <span>Hướng dẫn sử dụng</span>
            </button>
            <Link to="/profile" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
              <Settings className="w-5 h-5 text-slate-400" /> Cài đặt
            </Link>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors mt-1">
              <LogOut className="w-5 h-5 text-slate-400" /> Đăng xuất
            </button>
          </div>
        </aside>

        <main className="flex-1 md:ml-64 bg-slate-50 p-4 sm:p-8 overflow-y-auto h-full">
          <div className="font-sans max-w-7xl mx-auto">{children}</div>
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
          <button onClick={() => setShowHelpModal(true)} className="text-slate-500 hover:text-blue-600 transition-colors p-1" title="Hướng dẫn sử dụng">
            <HelpCircle className="w-5 h-5" />
          </button>
          <button onClick={handleLogout} className="text-slate-500 hover:text-red-600 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5 font-bold text-slate-900 text-lg">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <span>Hướng dẫn sử dụng EduCreate</span>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <p className="text-sm text-slate-600 leading-relaxed">
                Chào mừng quý thầy cô đến với <strong className="text-blue-600">EduCreate</strong> - Trợ lý AI thiết kế bài giảng và kế hoạch giảng dạy chuyên nghiệp! Chỉ với vài bước đơn giản, thầy cô sẽ sở hữu ngay các tài liệu giảng dạy tối ưu chuẩn sư phạm.
              </p>

              <div className="space-y-5">
                <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950 text-sm mb-1">Bước 1: Chọn Tính Năng Cần Tạo</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">Lựa chọn một trong các tính năng chuyên nghiệp tại menu bên trái: <strong className="text-slate-800">Soạn Giáo Án</strong>, <strong className="text-slate-800">Lập Kế Hoạch</strong>, <strong className="text-slate-800">AI Video</strong>, hoặc <strong className="text-slate-800">Tạo Infographic</strong>.</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950 text-sm mb-1">Bước 2: Nhập API Key & Thông Tin</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">Vào <strong className="text-slate-800">Cài đặt tài khoản</strong> để nhập Gemini API Key cá nhân (lấy miễn phí tại Google AI Studio). Sau đó điền chủ đề, yêu cầu bài dạy và tải lên tài liệu tham khảo nếu có.</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950 text-sm mb-1">Bước 3: Chạy Luồng Phân Tích AI</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">Nhấn nút <strong className="text-purple-700">"Chạy luồng xử lý AI"</strong>. Hệ thống AI sẽ lập tức thiết kế nội dung khoa học và tối ưu cấu trúc sư phạm.</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-950 text-sm mb-1">Bước 4: Lưu Trữ & Xuất Bản</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">Lưu bài giảng vào tài khoản hoặc tải về dưới định dạng <strong className="text-emerald-700">Word (DOC)</strong>, <strong className="text-emerald-700">PowerPoint (PPT)</strong>, hay <strong className="text-emerald-700">Infographic</strong>.</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
                <span className="font-semibold block mb-1 text-blue-950">Mẹo nhỏ:</span>
                Yêu cầu nhập càng chi tiết kết hợp với tài liệu đính kèm sẽ giúp AI tạo ra giáo án chất lượng cao nhất!
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowHelpModal(false)} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-xs sm:text-sm shadow-md shadow-blue-100 transition-all cursor-pointer">
                Đã hiểu, Bắt đầu ngay!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
