import { useEffect, useState } from "react";
import { Link } from "react-router";
import Layout from "../components/Layout";
import { 
  BookOpen, 
  Calendar, 
  MonitorPlay, 
  Presentation, 
  Clock, 
  ArrowRight, 
  FileText, 
  AlertTriangle, 
  RefreshCw, 
  HelpCircle,
  ChevronDown,
  Settings,
  LogOut,
  Image,
  FlaskConical,
  Cpu,
  BrainCircuit,
  Share2,
  Copy,
  Check,
  Link as LinkIcon,
  UserPlus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileEdit
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { useToast } from "../context/ToastContext";
import { db, auth } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  setDoc,
  serverTimestamp,
  limit 
} from "firebase/firestore";
import { ResourceItem } from "../types";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";

interface ChartDataPoint {
  date: string;
  formattedDate: string;
  "Học liệu": number;
  "Giáo án": number;
  "AI Video": number;
  "Kế hoạch": number;
  "Chuyển đổi số": number;
}

function generateLast30DaysData(resources: ResourceItem[]): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    
    const formattedDate = `${d.getDate()}/${d.getMonth() + 1}`;
    const dateKey = d.toDateString();
    
    data.push({
      date: dateKey,
      formattedDate,
      "Học liệu": 0,
      "Giáo án": 0,
      "AI Video": 0,
      "Kế hoạch": 0,
      "Chuyển đổi số": 0
    });
  }
  
  resources.forEach(item => {
    if (!item.createdAt) return;
    
    let itemDate: Date;
    if (item.createdAt.seconds) {
      itemDate = new Date(item.createdAt.seconds * 1000);
    } else {
      itemDate = new Date(item.createdAt);
    }
    
    itemDate.setHours(0, 0, 0, 0);
    const itemDateKey = itemDate.toDateString();
    
    const matchedPoint = data.find(p => p.date === itemDateKey);
    if (matchedPoint) {
      matchedPoint["Học liệu"]++;
      if (item.type === "lesson_plan") {
        matchedPoint["Giáo án"]++;
      } else if (item.type === "video") {
        matchedPoint["AI Video"]++;
      } else if (item.type === "plan") {
        matchedPoint["Kế hoạch"]++;
      } else if (item.type === "digital") {
        matchedPoint["Chuyển đổi số"]++;
      }
    }
  });
  
  return data;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const total = data["Học liệu"];
    
    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-800 text-xs min-w-[200px] space-y-2">
        <p className="font-bold border-b border-slate-800 pb-1.5 text-slate-300">Ngày {label}</p>
        <div className="space-y-1 text-left">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Tổng cộng:</span>
            <span className="font-bold text-blue-400 text-sm">{total}</span>
          </div>
          {total > 0 && (
            <div className="pt-1.5 border-t border-dashed border-slate-800 space-y-1">
              {data["Giáo án"] > 0 && (
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">• Soạn Giáo Án:</span>
                  <span className="font-semibold text-blue-300">{data["Giáo án"]}</span>
                </div>
              )}
              {data["AI Video"] > 0 && (
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">• Video AI:</span>
                  <span className="font-semibold text-indigo-300">{data["AI Video"]}</span>
                </div>
              )}
              {data["Kế hoạch"] > 0 && (
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">• Lập Kế Hoạch:</span>
                  <span className="font-semibold text-emerald-300">{data["Kế hoạch"]}</span>
                </div>
              )}
              {data["Chuyển đổi số"] > 0 && (
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">• Chuyển Đổi Số:</span>
                  <span className="font-semibold text-amber-300">{data["Chuyển đổi số"]}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [history, setHistory] = useState<ResourceItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [stats, setStats] = useState({ total: 0, videos: 0, plans: 0, lessonPlans: 0 });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const [expiryWarning, setExpiryWarning] = useState<string | null>(null);
  const [showNameMenu, setShowNameMenu] = useState(false);

  // Sharing states
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importing, setImporting] = useState(false);

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleShare = async (item: ResourceItem) => {
    if (!item.shareCode) {
      setSharing(true);
      try {
        const code = generateCode();
        await updateDoc(doc(db, "resources", item.id), {
          shareCode: code,
          isShared: true,
          workplace: userProfile?.workplace || ""
        });
        item.shareCode = code;
        item.isShared = true;
        toast.success("Đã kích hoạt tính năng chia sẻ!");
      } catch (e) {
        console.error("Error sharing:", e);
        toast.error("Không thể kích hoạt chia sẻ.");
      } finally {
        setSharing(false);
      }
    }
    setSelectedResource(item);
    setShowShareModal(true);
  };

  const handleImport = async () => {
    if (!importCode.trim() || !user) return;
    setImporting(true);
    try {
      const q = query(
        collection(db, "resources"),
        where("shareCode", "==", importCode.trim().toUpperCase()),
        where("isShared", "==", true),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast.error("Mã mời không chính xác hoặc giáo án không còn được chia sẻ.");
        return;
      }

      const sourceDoc = querySnapshot.docs[0];
      const sourceData = sourceDoc.data();

      // Check workplace if needed
      if (sourceData.workplace && userProfile?.workplace && sourceData.workplace !== userProfile.workplace) {
        toast.warning("Lưu ý: Giáo án này thuộc về trường khác. Bạn vẫn có thể nhập nếu có mã mời.");
      }

      // Create a copy for the current user
      await addDoc(collection(db, "resources"), {
        userId: user.uid,
        title: `${sourceData.title} (Bản sao)`,
        type: sourceData.type,
        content: sourceData.content,
        createdAt: serverTimestamp()
      });

      toast.success("Đã nhập giáo án thành công vào kho của thầy cô!");
      setShowImportModal(false);
      setImportCode("");
      
      // Refresh history
      window.location.reload(); 
    } catch (e) {
      console.error("Error importing:", e);
      toast.error("Lỗi khi nhập giáo án.");
    } finally {
      setImporting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Đã sao chép mã mời!");
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!user) return;
    async function fetchHistory() {
      try {
        const q = query(
          collection(db, "resources"),
          where("userId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const items: ResourceItem[] = [];
        let videos = 0;
        let plans = 0;
        let lessonPlans = 0;
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          items.push({ id: doc.id, ...data } as ResourceItem);
          if (data.type === 'video') videos++;
          if (data.type === 'plan') plans++;
          if (data.type === 'lesson_plan') lessonPlans++;
        });
        
        // Generate activity chart data for the last 30 days
        const generatedChartData = generateLast30DaysData(items);
        setChartData(generatedChartData);

        // Sort client-side by createdAt descending
        items.sort((a, b) => {
          const dateA = a.createdAt ? (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime()) : 0;
          const dateB = b.createdAt ? (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime()) : 0;
          return dateB - dateA;
        });

        setStats({ total: items.length, videos, plans, lessonPlans });
        setHistory(items.slice(0, 5)); // Show top 5
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoadingHistory(false);
      }
    }
    fetchHistory();
  }, [user]);

  // 3. Subscription Expiring Warnings Check
  useEffect(() => {
    if (userProfile?.expiresAt && userProfile?.package && userProfile.package !== 'free') {
      const expiryDate = new Date(userProfile.expiresAt);
      const now = new Date();
      const diffTime = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 3 && diffDays >= 0) {
        setExpiryWarning(`Gói đăng ký ${userProfile.package.toUpperCase()} của thầy cô sắp hết hạn sau ${diffDays} ngày nữa (${expiryDate.toLocaleDateString('vi-VN')}). Hãy gia hạn sớm để tránh gián đoạn dịch vụ!`);
      } else if (diffDays < 0) {
        setExpiryWarning(`Gói đăng ký ${userProfile.package.toUpperCase()} của thầy cô đã hết hạn vào ngày ${expiryDate.toLocaleDateString('vi-VN')}. Vui lòng gia hạn gói để tiếp tục sử dụng.`);
      } else {
        setExpiryWarning(null);
      }
    } else {
      setExpiryWarning(null);
    }
  }, [userProfile]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        
        {/* Real-time subscription warning banner */}
        {expiryWarning && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl flex items-start gap-3 shadow-sm animate-pulse">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-amber-900 text-sm">Cảnh báo dịch vụ sắp hết hạn</h4>
              <p className="text-sm text-amber-700 mt-1">{expiryWarning}</p>
            </div>
            <Link 
              to="/profile" 
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors shrink-0"
            >
              Gia hạn ngay
            </Link>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Xin chào,</h1>
              <div className="relative inline-block">
                <button 
                  onClick={() => setShowNameMenu(!showNameMenu)}
                  className="text-2xl font-bold text-blue-600 hover:text-blue-700 tracking-tight flex items-center gap-1 transition-colors group cursor-pointer"
                >
                  {userProfile?.name || user?.displayName || "Thầy/Cô"}!
                  <ChevronDown className="w-5 h-5 text-blue-400 group-hover:text-blue-600 transition-colors" />
                </button>

                {showNameMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowNameMenu(false)}
                    ></div>
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 animate-fade-in origin-top-left">
                      <Link 
                        to="/profile" 
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => setShowNameMenu(false)}
                      >
                        <Settings className="w-4 h-4" />
                        Chỉnh sửa hồ sơ
                      </Link>
                      <button 
                        onClick={() => {
                          setShowNameMenu(false);
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
            <p className="text-sm text-slate-500 mt-1">Hệ thống tạo học liệu số & thông báo thời gian thực.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4 text-slate-400" /> Nhập qua mã
            </button>
            <Link to="/profile" className="px-4 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-slate-400" /> Hồ sơ & Gói cước
            </Link>
            <Link to="/tool/lesson_plan" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
              + Tạo mới
            </Link>
          </div>
        </div>

        {/* Quick Stats / Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-100">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tài nguyên đã tạo</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.total}</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center border border-indigo-100">
              <Presentation className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Video AI Studio</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.videos}</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center border border-emerald-100">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Giáo án đã soạn</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.lessonPlans}</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center border border-amber-100">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kế hoạch giảng dạy</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.plans}</h3>
            </div>
          </div>
        </div>

        {/* Main Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Link to="/tool/lesson_plan" className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md hover:border-blue-300 transition-all group flex flex-col justify-between shadow-sm">
            <div>
              <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors mb-4">
                <BookOpen className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">Soạn Giáo Án</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Tự động hóa việc tạo giáo án chuẩn Bộ GD&ĐT.
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Mở công cụ <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link to="/tool/video" className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md hover:border-indigo-300 transition-all group flex flex-col justify-between shadow-sm">
            <div>
              <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 transition-colors mb-4">
                <Presentation className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">AI Video Studio</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Chuyển đổi kịch bản thành video có giảng viên ảo.
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Mở công cụ <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link to="/tool/plan" className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md hover:border-emerald-300 transition-all group flex flex-col justify-between shadow-sm">
            <div>
              <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-600 transition-colors mb-4">
                <Calendar className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors">Lập Kế Hoạch</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Quản trị kế hoạch bài dạy và hoạt động ngoại khóa.
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-medium text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Mở công cụ <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link to="/tool/digital" className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md hover:border-amber-300 transition-all group flex flex-col justify-between shadow-sm">
            <div>
              <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-600 transition-colors mb-4">
                <MonitorPlay className="w-5 h-5 text-amber-600 group-hover:text-white transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-amber-600 transition-colors">Chuyển Đổi Số</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Giải pháp công nghệ và đánh giá trực tuyến.
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-medium text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Mở công cụ <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link to="/infographic-maker" className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md hover:border-rose-300 transition-all group flex flex-col justify-between shadow-sm">
            <div>
              <div className="w-10 h-10 bg-rose-50 border border-rose-100 rounded-lg flex items-center justify-center group-hover:bg-rose-600 transition-colors mb-4">
                <Image className="w-5 h-5 text-rose-600 group-hover:text-white transition-colors" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-rose-600 transition-colors">Tạo Infographic</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Thiết kế Infographic bài học từ tài liệu.
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-medium text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Mở công cụ <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>
        </div>

        {/* Teacher Activity Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-4 animate-fade-in text-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
                Tần suất biên soạn học liệu (30 ngày qua)
              </h2>
              <p className="text-xs text-slate-500 mt-1">Theo dõi thống kê số lượng tài nguyên học liệu số thầy cô đã khởi tạo</p>
            </div>
            
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">
                <span className="w-2.5 h-2.5 rounded bg-blue-600 block shadow-sm"></span>
                <span className="text-slate-600 font-semibold text-[11px]">Học liệu đã tạo ({stats.total})</span>
              </div>
            </div>
          </div>

          <div className="w-full h-72 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorHocLieu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="formattedDate" 
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="Học liệu" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorHocLieu)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dual Column: Left Recent History */}
        <div className="mt-6">
          
          {/* History Section */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-500" />
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Hoạt động gần đây</h2>
              </div>
              <span className="text-xs font-semibold text-slate-400">Xem top 5</span>
            </div>
            
            <div className="divide-y divide-slate-100 flex-1">
              {loadingHistory ? (
                <div className="flex justify-center items-center h-48">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : history.length > 0 ? (
                history.map(item => (
                  <div key={item.id} className="p-5 hover:bg-slate-50/50 transition-colors flex items-center justify-between gap-4 group">
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${
                        item.type === 'lesson_plan' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                        item.type === 'video' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                        item.type === 'plan' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                        'bg-amber-50 border-amber-100 text-amber-600'
                      }`}>
                        {item.type === 'lesson_plan' && <BookOpen className="w-4.5 h-4.5" />}
                        {item.type === 'video' && <Presentation className="w-4.5 h-4.5" />}
                        {item.type === 'plan' && <Calendar className="w-4.5 h-4.5" />}
                        {item.type === 'digital' && <MonitorPlay className="w-4.5 h-4.5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">{item.title}</h4>
                          {item.status && (
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${
                              item.status === 'finalized' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              item.status === 'in_review' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                              'bg-slate-50 text-slate-500 border-slate-100'
                            }`}>
                              {item.status === 'finalized' && <CheckCircle2 className="w-2.5 h-2.5" />}
                              {item.status === 'in_review' && <AlertCircle className="w-2.5 h-2.5" />}
                              {item.status === 'draft' && <FileEdit className="w-2.5 h-2.5" />}
                              {item.status === 'finalized' ? 'Hoàn tất' : item.status === 'in_review' ? 'Đang duyệt' : 'Bản thảo'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="uppercase tracking-wider font-bold text-slate-400">{item.type}</span>
                          <span>•</span>
                          <span>{new Date(item.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.type === 'lesson_plan' && (
                        <button 
                          onClick={() => handleShare(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors bg-white hover:bg-blue-50 border border-slate-100 rounded-md shadow-sm"
                          title="Chia sẻ giáo án"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      )}
                      <Link to={`/tool/${item.type}?id=${item.id}`} className="text-slate-400 hover:text-blue-600 transition-colors">
                        <ArrowRight className="w-4.5 h-4.5" />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center h-full flex flex-col justify-center items-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center mb-3 border border-slate-200">
                    <Clock className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Chưa có học liệu nào được soạn gần đây.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Share Modal */}
        {showShareModal && selectedResource && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-scale-in">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-blue-600" />
                  Chia sẻ giáo án
                </h3>
                <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                  <LinkIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-bold">Mã mời chia sẻ</p>
                    <p className="mt-1 opacity-80">Gửi mã này cho đồng nghiệp cùng trường để họ có thể nhập giáo án này vào kho cá nhân của họ.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Mã mời của bạn</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 border-2 border-slate-200 border-dashed rounded-xl px-4 py-3 text-center text-2xl font-black text-blue-700 tracking-[0.2em]">
                      {selectedResource.shareCode}
                    </div>
                    <button 
                      onClick={() => copyToClipboard(selectedResource.shareCode || "")}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center"
                      title="Sao chép mã"
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Liên kết xem trực tiếp & Góp ý</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-600 truncate flex items-center">
                      {window.location.origin}/shared/{selectedResource.shareCode}
                    </div>
                    <button 
                      onClick={() => copyToClipboard(`${window.location.origin}/shared/${selectedResource.shareCode}`)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 rounded-xl transition-all active:scale-95 flex items-center justify-center border border-slate-200"
                      title="Sao chép liên kết"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 italic ml-1">Đồng nghiệp có thể xem và để lại góp ý trực tiếp qua liên kết này.</p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => setShowShareModal(false)}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg"
                  >
                    Hoàn tất
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-scale-in">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  Nhập giáo án qua mã
                </h3>
                <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Nhập mã mời nhận được</label>
                  <input 
                    type="text"
                    maxLength={6}
                    value={importCode}
                    onChange={(e) => setImportCode(e.target.value.toUpperCase())}
                    placeholder="VD: ABC123"
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-2xl font-bold text-slate-900 placeholder:text-slate-300 focus:border-blue-500 focus:ring-0 focus:outline-none transition-all uppercase tracking-[0.2em]"
                  />
                </div>

                <p className="text-xs text-slate-500 text-center px-4 leading-relaxed">
                  Khi nhập đúng mã, một bản sao của giáo án sẽ được tự động tạo trong kho tài nguyên của thầy cô.
                </p>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowImportModal(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    onClick={handleImport}
                    disabled={importCode.length !== 6 || importing}
                    className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                    {importing ? "Đang xử lý..." : "Xác nhận nhập"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
