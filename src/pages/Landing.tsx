import { useState, useEffect } from "react";
import { Link } from "react-router";
import { BookOpen, Calendar, MonitorPlay, Presentation, ArrowRight, ArrowLeft, ArrowRightCircle, FlaskConical, Code, Cpu, BrainCircuit, Settings, LogOut, ChevronDown, Sparkles, Share2, Loader2, FileText } from "lucide-react";
import { useAuth } from "../AuthContext";
import Dashboard from "./Dashboard";
import { db, auth } from "../firebase";
import { collection, getDocs, query, orderBy, where, limit } from "firebase/firestore";
import CommunityFeed from "../components/CommunityFeed";
import { STEMPortal, AIPortal, ArduinoPortal } from "../components/InfoPortals";

interface SharedResource {
  id: string;
  title: string;
  type: string;
  content: string;
  userName?: string;
  workplace?: string;
  createdAt: any;
}

export default function Landing() {
  const [activeTab, setActiveTab] = useState<'home' | 'community' | 'share' | 'stem' | 'ai' | 'arduino'>('home');
  const { user, userProfile } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [sharedResources, setSharedResources] = useState<SharedResource[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("post")) {
      setActiveTab('community');
    }
  }, []);

  useEffect(() => {
    if (activeTab === "share") {
      fetchSharedResources();
    }
  }, [activeTab]);

  const fetchSharedResources = async () => {
    setLoadingShared(true);
    try {
      const q = query(
        collection(db, "resources"),
        where("isShared", "==", true),
        orderBy("createdAt", "desc"),
        limit(30)
      );
      const snapshot = await getDocs(q);
      const items: SharedResource[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as SharedResource);
      });
      setSharedResources(items);
    } catch (error) {
      console.error("Lỗi tải tài liệu chia sẻ:", error);
    } finally {
      setLoadingShared(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const typeLabel: Record<string, string> = {
    lesson_plan: "Giáo án",
    plan: "Kế hoạch",
    digital: "Chuyển đổi số",
    video: "Bài giảng Video",
    infographic: "Infographic",
  };

  const typeColor: Record<string, string> = {
    lesson_plan: "bg-blue-50 text-blue-600 border-blue-100",
    plan: "bg-emerald-50 text-emerald-600 border-emerald-100",
    digital: "bg-indigo-50 text-indigo-600 border-indigo-100",
    video: "bg-rose-50 text-rose-600 border-rose-100",
    infographic: "bg-amber-50 text-amber-600 border-amber-100",
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button onClick={() => setActiveTab('home')} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <BookOpen className="text-white h-5 w-5" />
              </div>
              <span className="font-bold text-xl text-slate-900 tracking-tight">EduCreate Enterprise</span>
            </button>

            <div className="hidden md:flex items-center space-x-6">
              <button
                onClick={() => setActiveTab('community')}
                className={`text-sm font-medium transition-colors ${activeTab === 'community' ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Cộng đồng
              </button>
              <button
                onClick={() => setActiveTab('share')}
                className={`text-sm font-medium transition-colors ${activeTab === 'share' ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Chia sẻ
              </button>
              {user && (
                <Link
                  to="/dashboard"
                  className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors"
                >
                  Trình quản lý
                </Link>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {!user ? (
                <>
                  <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Đăng nhập</Link>
                  <Link to="/login" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    Dùng thử miễn phí
                  </Link>
                </>
              ) : (
                <div className="relative">
                  <div
                    className="flex items-center gap-2 cursor-pointer group hover:bg-slate-50 px-2 py-1.5 rounded-lg transition-colors"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                  >
                    {userProfile?.avatar ? (
                      <img
                        src={userProfile.avatar}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold border border-slate-300 group-hover:border-blue-300 transition-colors">
                        {userProfile?.name?.[0] || user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-700 hidden sm:block group-hover:text-slate-900 transition-colors">
                      {userProfile?.name || user?.displayName || "Giáo viên"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
                  </div>

                  {showUserMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowUserMenu(false)}
                      ></div>
                      <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 animate-fade-in origin-top-right overflow-hidden">
                        <Link
                          to="/profile"
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Settings className="w-4 h-4" />
                          Cài đặt tài khoản
                        </Link>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
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
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        {/* Home Tab */}
        {activeTab === 'home' && (
          <section className="relative pt-20 pb-32 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
              <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-16 max-w-4xl mx-auto leading-tight">
                Tạo <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">giáo án & tài nguyên</span> với Trí tuệ nhân tạo
              </h1>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                <button onClick={() => setActiveTab('stem')} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-rose-200 transition-all group text-left cursor-pointer relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-rose-500 text-white text-[8px] px-2 py-0.5 font-bold uppercase tracking-widest rounded-bl-lg">Thông tin</div>
                  <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FlaskConical className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">Dự án STEM</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">Hướng dẫn thí nghiệm ảo, nghiên cứu STEM liên môn và dự án thực tế cho học sinh.</p>
                  <div className="flex items-center text-xs font-bold text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Xem chi tiết <ArrowRight className="w-3 h-3 ml-1" />
                  </div>
                </button>

                <Link to="/tool/lesson_plan" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all group text-left cursor-pointer relative">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Code className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">Lập trình Lớp học</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">Hỗ trợ soạn bài giảng lập trình Python, C++, Scratch và giải thuật thông minh.</p>
                  <div className="flex items-center text-xs font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Mở công cụ <ArrowRight className="w-3 h-3 ml-1" />
                  </div>
                </Link>

                <button onClick={() => setActiveTab('arduino')} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-amber-200 transition-all group text-left cursor-pointer relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] px-2 py-0.5 font-bold uppercase tracking-widest rounded-bl-lg">Thông tin</div>
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">Arduino & Robotics</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">Lập trình vi điều khiển, sơ đồ mạch điện và tự động hóa cho các dự án sáng tạo.</p>
                  <div className="flex items-center text-xs font-bold text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Xem chi tiết <ArrowRight className="w-3 h-3 ml-1" />
                  </div>
                </button>

                <button onClick={() => setActiveTab('ai')} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all group text-left cursor-pointer relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[8px] px-2 py-0.5 font-bold uppercase tracking-widest rounded-bl-lg">Thông tin</div>
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <BrainCircuit className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">Trí tuệ nhân tạo (AI)</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">Tìm hiểu và ứng dụng AI vào học tập, từ Machine Learning đến xử lý ngôn ngữ.</p>
                  <div className="flex items-center text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Xem chi tiết <ArrowRight className="w-3 h-3 ml-1" />
                  </div>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to={user ? "/dashboard" : "/login"} className="w-full sm:w-auto px-8 py-4 text-base font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                  {user ? "Vào trình quản lý" : "Bắt đầu ngay"} <ArrowRight className="w-5 h-5" />
                </Link>
                <button onClick={() => setActiveTab('community')} className="w-full sm:w-auto px-8 py-4 text-base font-semibold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  Khám phá Cộng đồng
                </button>
              </div>
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-blue-100 to-indigo-50 rounded-full blur-3xl -z-10 opacity-60"></div>
          </section>
        )}

        {/* STEM Portal */}
        {activeTab === 'stem' && <STEMPortal />}

        {/* AI Portal */}
        {activeTab === 'ai' && <AIPortal />}

        {/* Arduino Portal */}
        {activeTab === 'arduino' && <ArduinoPortal />}

        {/* Community Tab */}
        {activeTab === 'community' && (
          <section className="py-6 bg-slate-50 min-h-[calc(100vh-160px)]">
            <CommunityFeed />
          </section>
        )}

        {/* Share Tab */}
        {activeTab === 'share' && (
          <section className="py-12 bg-slate-50 min-h-[calc(100vh-160px)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-6 border-b border-slate-200">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-3">
                    <Share2 className="w-3.5 h-3.5 text-blue-600" /> Tài liệu được chia sẻ từ cộng đồng
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">Thư viện Chia sẻ</h2>
                  <p className="text-base text-slate-600 max-w-2xl">Khám phá các giáo án, kế hoạch và tài liệu giảng dạy được giáo viên chia sẻ miễn phí.</p>
                </div>
                {user && (
                  <Link
                    to="/dashboard"
                    className="w-full md:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2 shrink-0"
                  >
                    <Sparkles className="w-5 h-5" />
                    Tạo & chia sẻ tài liệu
                  </Link>
                )}
              </div>

              {loadingShared ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : sharedResources.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                  <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Share2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Chưa có tài liệu chia sẻ</h3>
                  <p className="text-slate-500 max-w-sm mx-auto mb-6">Hãy là người đầu tiên chia sẻ tài liệu giảng dạy với cộng đồng!</p>
                  {user && (
                    <Link to="/dashboard" className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all inline-flex items-center gap-2">
                      <ArrowRightCircle className="w-4 h-4" /> Vào dashboard để chia sẻ
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sharedResources.map((item) => (
                    <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                      <div className="p-6 flex-1">
                        <div className="flex items-center justify-between mb-4">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${typeColor[item.type] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {typeLabel[item.type] || item.type}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleDateString('vi-VN') : ''}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 mb-2 line-clamp-2">{item.title}</h3>

                        <div className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4 font-mono bg-slate-50 p-3 rounded-lg border border-slate-100">
                          {item.content ? item.content.substring(0, 200) + "..." : "Không có nội dung xem trước."}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-50">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {item.workplace ? item.workplace : "Giáo viên"}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                        <Link
                          to={user ? `/tool/${item.type}?id=${item.id}` : "/login"}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" />
                          {user ? "Mở & Chỉnh sửa" : "Đăng nhập để xem"}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <BookOpen className="text-blue-600 h-6 w-6" />
            <span className="font-bold text-xl text-slate-900 tracking-tight">EduCreate</span>
          </div>
          <div className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} EduCreate Enterprise. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
