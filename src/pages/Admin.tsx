import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { db } from "../firebase";
import { collection, updateDoc, doc, addDoc, serverTimestamp, onSnapshot, query, orderBy, deleteDoc, writeBatch, getDoc, getDocs, limit, setDoc } from "firebase/firestore";
import { 
  Shield, 
  Loader2, 
  UserCircle, 
  Search, 
  Edit2, 
  Check, 
  X, 
  Users, 
  Sparkles, 
  Award, 
  Zap, 
  Calendar, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  UserCheck,
  Building,
  Mail,
  Phone,
  MessageSquare,
  Trash2,
  Globe,
  Image as ImageIcon,
  Bug
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router";
import { getAuth } from "firebase/auth";
import AdminTransactions from "../components/AdminTransactions";
import { checkIsAdmin } from "../lib/permissions";

interface UserData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  workplace?: string;
  verified?: boolean;
  package?: string;
  expiresAt?: string | null;
}

export default function Admin() {
  const { user, userProfile, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && checkIsAdmin(user, userProfile) && userProfile?.package !== 'admin') {
      console.log("Auto-syncing admin status to Firestore...");
      setDoc(doc(db, "users", user.uid), { package: "admin" }, { merge: true }).catch(console.error);
    }
  }, [user, userProfile]);

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "pro" | "enterprise" | "free">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [activeAdminTab, setActiveAdminTab] = useState<"users" | "transactions" | "competitions" | "community" | "diagnostics">("users");
  const [allPosts, setAllPosts] = useState<any[]>([]);

  // Open transactions tab if coming from telegram link
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('approve_tx') || searchParams.get('reject_tx')) {
      setActiveAdminTab("transactions");
    }
  }, []);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [bulkDeletingPosts, setBulkDeletingPosts] = useState(false);
  
  // Diagnostics
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [runningDiag, setRunningDiag] = useState(false);

  const runDiagnostics = async () => {
    setRunningDiag(true);
    setDiagnosticLogs(["Bắt đầu chạy chẩn đoán..."]);
    const log = (msg: string) => setDiagnosticLogs(prev => [...prev, msg]);
    
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        log("Lỗi: Không tìm thấy người dùng hiện tại trong auth.");
        setRunningDiag(false);
        return;
      }
      
      log(`User ID (UID): ${currentUser.uid}`);
      log(`User Email: ${currentUser.email}`);
      
      const token = await currentUser.getIdTokenResult(true);
      log(`Token Claims: ${JSON.stringify(token.claims)}`);
      log(`Token có email?: ${'email' in token.claims ? 'Có' : 'Không'}`);
      
      const userDocRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        log(`User Document Tồn tại. Dữ liệu: ${JSON.stringify(userDoc.data())}`);
        log(`Trường 'package': ${userDoc.data().package || 'Không có'}`);
      } else {
        log("Lỗi: Không tìm thấy User Document trong Firestore!");
      }
      
      const postsSnapshot = await getDocs(query(collection(db, "posts"), limit(1)));
      if (!postsSnapshot.empty) {
        const p = postsSnapshot.docs[0];
        log(`Đã lấy 1 Post để kiểm tra. ID: ${p.id}, userId của Post: ${p.data().userId}`);
      } else {
        log("Không tìm thấy Post nào trong database.");
      }
      
      log("Chẩn đoán hoàn tất!");
    } catch (e: any) {
      log(`LỖI TRONG QUÁ TRÌNH CHẨN ĐOÁN: ${e.message}`);
      console.error(e);
    }
    setRunningDiag(false);
  };

  // Manual inline edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPackage, setEditPackage] = useState("");
  const [editDays, setEditDays] = useState(30);

  // Competitions & Submissions states
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [newCompTitle, setNewCompTitle] = useState("");
  const [newCompDesc, setNewCompDesc] = useState("");
  const [newCompRules, setNewCompRules] = useState("");
  const [newCompType, setNewCompType] = useState("STEM / Tự nhiên");
  const [newCompDate, setNewCompDate] = useState("");
  const [newCompStatus, setNewCompStatus] = useState<"Đang diễn ra" | "Sắp diễn ra" | "Đã kết thúc">("Đang diễn ra");
  
  // Grading states
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [gradingGrade, setGradingGrade] = useState("A+");
  const [gradingComment, setGradingComment] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);

  useEffect(() => {
    if (activeAdminTab === "competitions") {
      const qCompetitions = query(collection(db, "competitions"), orderBy("createdAt", "desc"));
      const unsubscribeComp = onSnapshot(qCompetitions, (snapshot) => {
        const compItems: any[] = [];
        snapshot.forEach((doc) => {
          compItems.push({ id: doc.id, ...doc.data() });
        });
        setCompetitions(compItems);
      }, (error) => {
        console.error("Lỗi real-time cuộc thi:", error);
      });

      const qSubmissions = query(collection(db, "submissions"), orderBy("submittedAt", "desc"));
      const unsubscribeSub = onSnapshot(qSubmissions, (snapshot) => {
        const subItems: any[] = [];
        snapshot.forEach((doc) => {
          subItems.push({ id: doc.id, ...doc.data() });
        });
        setSubmissions(subItems);
      }, (error) => {
        console.error("Lỗi real-time bài nộp:", error);
      });

      return () => {
        unsubscribeComp();
        unsubscribeSub();
      };
    } else if (activeAdminTab === "community") {
      const qPosts = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      const unsubscribePosts = onSnapshot(qPosts, (snapshot) => {
        const postItems: any[] = [];
        snapshot.forEach((doc) => {
          postItems.push({ id: doc.id, ...doc.data() });
        });
        setAllPosts(postItems);
      }, (error) => {
        console.error("Lỗi real-time bài đăng cộng đồng:", error);
      });

      return () => unsubscribePosts();
    }
  }, [activeAdminTab]);

  const handleToggleSelectPost = (id: string) => {
    setSelectedPostIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllPosts = () => {
    if (selectedPostIds.length === allPosts.length) {
      setSelectedPostIds([]);
    } else {
      setSelectedPostIds(allPosts.map(p => p.id));
    }
  };

  const handleBulkDeletePosts = async () => {
    setBulkDeletingPosts(true);
    try {
      const batch = writeBatch(db);
      selectedPostIds.forEach(id => {
        batch.delete(doc(db, "posts", id));
      });
      await batch.commit();
      setSelectedPostIds([]);
      showToast(`Đã xóa thành công ${selectedPostIds.length} bài viết cộng đồng.`, "success");
    } catch (error) {
      console.error("Lỗi xóa bài viết hàng loạt:", error);
      showToast("Gặp lỗi khi xóa hàng loạt bài viết.", "error");
    } finally {
      setBulkDeletingPosts(false);
    }
  };

  const handleAddCompetition = async () => {
    if (!newCompTitle.trim() || !newCompDesc.trim() || !newCompRules.trim() || !newCompDate.trim()) {
      showToast("Vui lòng nhập đầy đủ các trường thông tin cho cuộc thi!", "error");
      return;
    }
    try {
      await addDoc(collection(db, "competitions"), {
        title: newCompTitle.trim(),
        description: newCompDesc.trim(),
        rules: newCompRules.trim(),
        type: newCompType,
        date: newCompDate.trim(),
        status: newCompStatus,
        createdAt: serverTimestamp()
      });
      showToast("Đã ghi nhận và tổ chức cuộc thi mới thành công!");
      setShowAddCompModal(false);
      
      // Clear inputs
      setNewCompTitle("");
      setNewCompDesc("");
      setNewCompRules("");
      setNewCompDate("");
    } catch (e) {
      console.error("Lỗi thêm cuộc thi:", e);
      showToast("Gặp lỗi khi tạo cuộc thi mới.", "error");
    }
  };

  const handleGradeSubmission = async (subId: string) => {
    setSavingGrade(true);
    try {
      const subRef = doc(db, "submissions", subId);
      await updateDoc(subRef, {
        status: "Đã chấm điểm",
        grade: gradingGrade,
        comment: gradingComment.trim()
      });

      // Find the user ID of the submission to send real-time notification
      const subObj = submissions.find(s => s.id === subId);
      if (subObj) {
        await addDoc(collection(db, "notifications"), {
          userId: subObj.userId,
          type: "grade",
          title: "Bài dự thi đã được chấm điểm!",
          message: `Bài dự thi "${subObj.resourceTitle}" của thầy cô đã được Admin chấm đạt loại: ${gradingGrade}.`,
          createdAt: serverTimestamp(),
          read: false
        });
      }

      showToast("Đã cập nhật điểm số và phản hồi cho bài dự thi!");
      setGradingSubId(null);
      setGradingComment("");
    } catch (e) {
      console.error("Lỗi chấm điểm bài nộp:", e);
      showToast("Không thể lưu kết quả chấm điểm.", "error");
    } finally {
      setSavingGrade(false);
    }
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        const items: UserData[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          let currentPackage = data.package || "free";
          let expiresAt = data.expiresAt || null;
          
          // Auto-check expiry
          if (expiresAt && new Date(expiresAt) < new Date()) {
            currentPackage = "free";
            expiresAt = null;
            // Synchronize database asynchronously
            updateDoc(doc.ref, { package: "free", expiresAt: null }).catch(console.error);
          }
          
          items.push({ 
            id: doc.id, 
            ...data,
            package: currentPackage,
            expiresAt: expiresAt
          } as UserData);
        });
        setUsers(items);
        setLoading(false);
      }, (error) => {
        console.error("Lỗi real-time người dùng:", error);
        showToast("Không có quyền tải dữ liệu hoặc lỗi kết nối.", "error");
        setLoading(false);
      });

      return () => unsubscribe();
    } else if (!authLoading && !isAdmin) {
      navigate("/");
    }
  }, [authLoading, isAdmin, navigate]);

  const handleEdit = (u: UserData) => {
    setEditingId(u.id);
    setEditPackage(u.package || "free");
    setEditDays(30);
  };

  const handleSave = async (id: string, userEmail: string) => {
    setUpdatingId(id);
    try {
      let expiresAtStr: string | null = null;
      if (editPackage !== "free") {
        const d = new Date();
        d.setDate(d.getDate() + editDays);
        expiresAtStr = d.toISOString();
      }
      
      await updateDoc(doc(db, "users", id), {
        package: editPackage,
        expiresAt: expiresAtStr
      });

      // Send real-time notification
      try {
        await addDoc(collection(db, "notifications"), {
          userId: id,
          type: "expiry",
          title: "Thay đổi trạng thái tài khoản!",
          message: editPackage === "free"
            ? "Quản trị viên đã cập nhật tài khoản của thầy cô về gói Cơ bản."
            : `Quản trị viên đã gia hạn tài khoản của thầy cô lên gói ${editPackage.toUpperCase()} thời hạn ${editDays} ngày.`,
          createdAt: serverTimestamp(),
          read: false
        });
      } catch (e) {
        console.error("Lỗi gửi thông báo:", e);
      }
      
      setUsers(users.map(u => 
        u.id === id ? { ...u, package: editPackage, expiresAt: expiresAtStr } : u
      ));
      setEditingId(null);
      showToast(`Đã lưu thay đổi cho người dùng ${userEmail}`);
    } catch (error) {
      console.error("Lỗi cập nhật gói:", error);
      showToast("Gặp lỗi khi lưu chỉnh sửa gói cước.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Quick Override Subscriptions
  const handleQuickOverride = async (
    userId: string, 
    userEmail: string, 
    packageName: "free" | "pro" | "enterprise", 
    days: number | null
  ) => {
    setUpdatingId(userId);
    try {
      let expiresAtStr: string | null = null;
      if (packageName !== "free" && days !== null) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        expiresAtStr = d.toISOString();
      }

      await updateDoc(doc(db, "users", userId), {
        package: packageName,
        expiresAt: expiresAtStr
      });

      // Push a direct real-time notification
      try {
        await addDoc(collection(db, "notifications"), {
          userId: userId,
          type: "expiry",
          title: "Gia hạn gói dịch vụ thành công!",
          message: packageName === "free"
            ? "Hệ thống quản trị đã điều chỉnh tài khoản của thầy cô về gói Cơ bản."
            : `Hệ thống đã cập nhật gói ${packageName.toUpperCase()} của thầy cô thời hạn ${days} ngày (Hết hạn: ${new Date(expiresAtStr!).toLocaleDateString("vi-VN")}).`,
          createdAt: serverTimestamp(),
          read: false
        });
      } catch (notifErr) {
        console.error("Lỗi gửi thông báo gia hạn:", notifErr);
      }

      setUsers(prevUsers => prevUsers.map(u => 
        u.id === userId ? { ...u, package: packageName, expiresAt: expiresAtStr } : u
      ));
      showToast(`Đã chuyển thành công gói ${packageName.toUpperCase()} (${days ? days + " ngày" : "Hủy"}) cho ${userEmail}`);
    } catch (error) {
      console.error("Lỗi cập nhật nhanh gói:", error);
      showToast("Lỗi khi cập nhật thời hạn nhanh.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const getExpiryStatus = (u: UserData) => {
    if (!u.package || u.package === "free") {
      return { label: "Cơ bản", color: "bg-slate-100 text-slate-700 border-slate-200" };
    }
    if (!u.expiresAt) {
      return { label: "Vô thời hạn", color: "bg-purple-100 text-purple-800 border-purple-200" };
    }
    
    const expiryDate = new Date(u.expiresAt);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: "Đã hết hạn", color: "bg-red-100 text-red-800 border-red-200" };
    } else if (diffDays <= 3) {
      return { label: `Sắp hết hạn (${diffDays} ngày)`, color: "bg-amber-100 text-amber-800 border-amber-200" };
    } else {
      return { label: `Còn ${diffDays} ngày`, color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    }
  };

  // Search and Filter logic
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.workplace?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeFilter === "all") return matchesSearch;
    if (activeFilter === "pro") return matchesSearch && u.package === "pro";
    if (activeFilter === "enterprise") return matchesSearch && u.package === "enterprise";
    if (activeFilter === "free") return matchesSearch && (!u.package || u.package === "free");
    return matchesSearch;
  });

  // Calculate high level stats
  const totalUsers = users.length;
  const proUsersCount = users.filter(u => u.package === "pro").length;
  const entUsersCount = users.filter(u => u.package === "enterprise").length;
  const freeUsersCount = users.filter(u => !u.package || u.package === "free").length;

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col justify-center items-center h-96 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <p className="text-slate-500 font-medium text-sm">Đang tải cơ sở dữ liệu người dùng...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        
        {/* Floating Custom Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border animate-bounce transition-all bg-slate-900 border-slate-800 text-white">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        )}

        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shadow-sm border border-red-200">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quản Trị Hệ Thống</h1>
              <p className="text-sm text-slate-500 mt-1">Cấu hình nhanh, nâng cấp tài khoản & phê duyệt thời hạn giáo viên</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Dữ liệu thời gian thực
          </div>
        </div>

        {/* Statistics Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Giáo Viên</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{totalUsers}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gói Pro (Active)</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{proUsersCount}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center border border-purple-100">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gói Enterprise</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{entUsersCount}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center border border-slate-200">
              <UserCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gói Cơ Bản (Free)</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{freeUsersCount}</h3>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveAdminTab("users")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeAdminTab === "users" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Người dùng
          </button>
          <button
            onClick={() => setActiveAdminTab("transactions")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeAdminTab === "transactions" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Giao dịch chờ duyệt
          </button>
          <button
            onClick={() => setActiveAdminTab("competitions")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeAdminTab === "competitions" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Quản lý cuộc thi & Chấm bài
          </button>
          <button
            onClick={() => setActiveAdminTab("community")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeAdminTab === "community" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Kiểm duyệt Cộng đồng
          </button>
          <button
            onClick={() => setActiveAdminTab("diagnostics")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeAdminTab === "diagnostics" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Chẩn đoán Hệ thống
          </button>
        </div>

        {activeAdminTab === "transactions" ? (
          <AdminTransactions />
        ) : activeAdminTab === "diagnostics" ? (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-800">
              <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Bug className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-base">Công cụ Chẩn đoán Hệ thống</h3>
                </div>
                <button
                  onClick={runDiagnostics}
                  disabled={runningDiag}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                >
                  {runningDiag ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Chạy chẩn đoán Security Rules
                </button>
              </div>
              
              <div className="p-4 font-mono text-[11px] md:text-xs leading-relaxed text-emerald-400 max-h-[500px] overflow-y-auto" style={{ textShadow: "0 0 5px rgba(52,211,153,0.3)" }}>
                {diagnosticLogs.length === 0 ? (
                  <div className="text-slate-500 italic text-center py-10">
                    Bấm "Chạy chẩn đoán Security Rules" để bắt đầu kiểm tra luồng xác thực Firebase.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {diagnosticLogs.map((log, idx) => (
                      <div key={idx} className={`${log.startsWith("Lỗi:") || log.includes("LỖI") ? "text-rose-400" : ""}`}>
                        <span className="text-slate-600 mr-2">[{new Date().toLocaleTimeString('vi-VN')}]</span>
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeAdminTab === "community" ? (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-4 flex-wrap bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="font-black text-slate-800 text-base">Hệ thống kiểm duyệt cộng đồng</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Quản lý và gỡ bỏ các bài đăng vi phạm tiêu chuẩn cộng đồng giáo viên.</p>
                </div>
                {allPosts.length > 0 && (
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm ml-4">
                    <input 
                      type="checkbox" 
                      checked={selectedPostIds.length > 0 && selectedPostIds.length === allPosts.length}
                      onChange={handleSelectAllPosts}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Chọn tất cả bài viết</span>
                  </div>
                )}
              </div>
              
              {selectedPostIds.length > 0 && (
                <button
                  onClick={handleBulkDeletePosts}
                  disabled={bulkDeletingPosts}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 animate-in slide-in-from-right-4"
                >
                  {bulkDeletingPosts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Xóa {selectedPostIds.length} bài đã chọn
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allPosts.map((post) => (
                <div 
                  key={post.id} 
                  className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col ${
                    selectedPostIds.includes(post.id) ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="p-4 border-b border-slate-50 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={selectedPostIds.includes(post.id)}
                          onChange={() => handleToggleSelectPost(post.id)}
                          className="absolute -top-1 -left-1 w-5 h-5 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm z-10"
                        />
                        {post.userAvatar ? (
                          <img src={post.userAvatar} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs">
                            {post.userName?.[0]}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{post.userName}</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleString('vi-VN') : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        await deleteDoc(doc(db, "posts", post.id));
                        showToast("Đã gỡ bài đăng.", "success");
                      }}
                      className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="p-4 flex-grow">
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-4 italic">"{post.content}"</p>
                    {post.imageUrl && (
                      <div className="mt-3 relative rounded-lg overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center h-32">
                        <img src={post.imageUrl} alt="" className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {post.commentsCount || 0}</span>
                      <span className="flex items-center gap-1"><Check className="w-3 h-3" /> {post.loves?.length || 0}</span>
                    </div>
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Công khai</span>
                  </div>
                </div>
              ))}
            </div>

            {allPosts.length === 0 && (
              <div className="py-20 bg-white rounded-3xl border border-slate-200 border-dashed text-center">
                <Globe className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 text-sm font-semibold">Cộng đồng hiện không có bài đăng nào.</p>
              </div>
            )}
          </div>
        ) : activeAdminTab === "competitions" ? (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Top action header */}
            <div className="flex items-center justify-between gap-4 flex-wrap bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div>
                <h3 className="font-black text-slate-800 text-base">Hội đồng quản trị cuộc thi chuyên môn</h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">Xây dựng cuộc thi, duyệt bài nộp và chấm điểm giải thưởng cho thầy cô.</p>
              </div>
              <button
                onClick={() => {
                  setNewCompTitle("");
                  setNewCompDesc("");
                  setNewCompRules("");
                  setNewCompDate("");
                  setShowAddCompModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"
              >
                + Tổ chức cuộc thi mới
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Side: Competitions list */}
              <div className="lg:col-span-5 space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" /> Các hội thi đang chạy
                </h4>
                
                {competitions.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-semibold">
                    Chưa có cuộc thi nào được tổ chức. Hãy bấm "+ Tổ chức cuộc thi mới".
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {competitions.map((comp) => {
                      const count = submissions.filter(s => s.competitionId === comp.id).length;
                      return (
                        <div key={comp.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                              {comp.type}
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                              comp.status === 'Đang diễn ra' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500'
                            }`}>
                              {comp.status}
                            </span>
                          </div>
                          <div>
                            <h5 className="font-bold text-sm text-slate-900 leading-snug">{comp.title}</h5>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 line-clamp-2">{comp.description}</p>
                          </div>
                          <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                            <span>Hạn: <b className="text-slate-600">{comp.date}</b></span>
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                              {count} bài đã nộp
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Side: Submissions Grid & Grading panel */}
              <div className="lg:col-span-7 space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Tất cả bài dự thi nhận được
                </h4>

                {submissions.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-semibold leading-relaxed">
                    Chưa nhận được bài nộp dự thi nào từ các giáo viên.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                            <th className="px-4 py-3">Thí sinh</th>
                            <th className="px-4 py-3">Bài nộp</th>
                            <th className="px-4 py-3">Kết quả</th>
                            <th className="px-4 py-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {submissions.map((sub) => (
                            <tr key={sub.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3.5">
                                <p className="font-bold text-slate-800">{sub.userName}</p>
                                <p className="text-[10px] text-slate-400 font-semibold">{sub.userEmail}</p>
                              </td>
                              <td className="px-4 py-3.5">
                                <p className="font-bold text-blue-700 truncate max-w-[180px]" title={sub.resourceTitle}>
                                  {sub.resourceTitle}
                                </p>
                                <p className="text-[9px] text-slate-400 font-semibold truncate max-w-[180px]">
                                  {sub.competitionTitle}
                                </p>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider block w-fit mb-1 ${
                                  sub.status === "Chờ chấm điểm" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                                }`}>
                                  {sub.status}
                                </span>
                                {sub.grade && (
                                  <p className="text-[10px] font-bold text-rose-600">Đạt: <b>{sub.grade}</b></p>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <button
                                  onClick={() => {
                                    setGradingSubId(sub.id);
                                    setGradingGrade(sub.grade || "Giải Nhất (A+)");
                                    setGradingComment(sub.comment || "");
                                  }}
                                  className="bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold text-[11px] hover:bg-blue-600 transition-all shadow-sm"
                                >
                                  {sub.status === "Chờ chấm điểm" ? "Chấm điểm" : "Sửa điểm"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal: Thêm cuộc thi mới */}
            {showAddCompModal && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
                <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Tổ chức cuộc thi mới</h3>
                    <button onClick={() => setShowAddCompModal(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Tên cuộc thi</label>
                      <input
                        type="text"
                        value={newCompTitle}
                        onChange={(e) => setNewCompTitle(e.target.value)}
                        placeholder="Ví dụ: Thiết kế giáo án STEM tiêu biểu 2026"
                        className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Thể loại</label>
                        <select
                          value={newCompType}
                          onChange={(e) => setNewCompType(e.target.value)}
                          className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 focus:outline-none cursor-pointer bg-white"
                        >
                          <option value="STEM / Tự nhiên">STEM / Tự nhiên</option>
                          <option value="Công nghệ số">Công nghệ số</option>
                          <option value="Đồ họa Giáo dục">Đồ họa Giáo dục</option>
                          <option value="Xã hội / Nhân văn">Xã hội / Nhân văn</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Trạng thái</label>
                        <select
                          value={newCompStatus}
                          onChange={(e) => setNewCompStatus(e.target.value as any)}
                          className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 focus:outline-none cursor-pointer bg-white"
                        >
                          <option value="Đang diễn ra">Đang diễn ra</option>
                          <option value="Sắp diễn ra">Sắp diễn ra</option>
                          <option value="Đã kết thúc">Đã kết thúc</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Thời hạn diễn ra</label>
                      <input
                        type="text"
                        value={newCompDate}
                        onChange={(e) => setNewCompDate(e.target.value)}
                        placeholder="Ví dụ: 01/10/2026 - 31/12/2026"
                        className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Mô tả ngắn gọn</label>
                      <textarea
                        rows={2}
                        value={newCompDesc}
                        onChange={(e) => setNewCompDesc(e.target.value)}
                        placeholder="Mô tả tóm tắt ý nghĩa và mục tiêu cuộc thi..."
                        className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Thể lệ & Tiêu chí chấm thi</label>
                      <textarea
                        rows={3}
                        value={newCompRules}
                        onChange={(e) => setNewCompRules(e.target.value)}
                        placeholder="1. Bài thi soạn trên nền tảng...\n2. Đáp ứng tiêu chí..."
                        className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                  <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                    <button
                      onClick={() => setShowAddCompModal(false)}
                      className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                    >
                      Đóng
                    </button>
                    <button
                      onClick={handleAddCompetition}
                      className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm"
                    >
                      Tổ chức ngay
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Chấm điểm bài dự thi */}
            {gradingSubId && (() => {
              const sub = submissions.find(s => s.id === gradingSubId);
              if (!sub) return null;
              return (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
                  <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Chấm thi & Đánh giá sư phạm</h3>
                      <button onClick={() => setGradingSubId(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-6 space-y-5 max-h-[500px] overflow-y-auto">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-slate-400 font-medium">Thí sinh:</p>
                          <p className="font-bold text-slate-800">{sub.userName}</p>
                          <p className="text-slate-500 font-semibold">{sub.userEmail}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Hội thi:</p>
                          <p className="font-bold text-slate-800">{sub.competitionTitle}</p>
                          <p className="text-slate-500 font-semibold">{new Date(sub.submittedAt?.seconds * 1000 || Date.now()).toLocaleDateString('vi-VN')}</p>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tên bài dự thi</h4>
                        <p className="font-black text-slate-900 text-sm">{sub.resourceTitle}</p>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nội dung bài viết / Sáng kiến</h4>
                        <div className="bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs max-h-[220px] overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-800 shadow-inner">
                          {sub.resourceContent}
                        </div>
                      </div>

                      {/* Form fields */}
                      <div className="border-t border-slate-100 pt-4 grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                          <label className="block text-xs font-bold text-slate-600 mb-1">Giải thưởng đạt</label>
                          <select
                            value={gradingGrade}
                            onChange={(e) => setGradingGrade(e.target.value)}
                            className="w-full text-xs font-semibold border border-slate-200 rounded-lg p-2.5 cursor-pointer focus:outline-none bg-white"
                          >
                            <option value="Giải Nhất (A+)">Giải Nhất (A+)</option>
                            <option value="Giải Nhì (A)">Giải Nhì (A)</option>
                            <option value="Giải Ba (B+)">Giải Ba (B+)</option>
                            <option value="Giải Khuyến khích (B)">Giải Khuyến khích (B)</option>
                            <option value="Đạt chuẩn sư phạm (C)">Đạt chuẩn (C)</option>
                            <option value="Chưa đạt yêu cầu (D)">Chưa đạt (D)</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-600 mb-1">Nhận xét của Hội đồng</label>
                          <input
                            type="text"
                            value={gradingComment}
                            onChange={(e) => setGradingComment(e.target.value)}
                            placeholder="Cấu trúc giáo án cực kỳ xuất sắc..."
                            className="w-full text-xs font-medium border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                      <button
                        onClick={() => setGradingSubId(null)}
                        className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                      >
                        Hủy bỏ
                      </button>
                      <button
                        onClick={() => handleGradeSubmission(sub.id)}
                        disabled={savingGrade}
                        className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow transition-all flex items-center gap-1"
                      >
                        {savingGrade && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Lưu kết quả & Gửi phản hồi
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Filters & Actions Panel */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-200/60 rounded-lg w-fit">
              <button 
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Tất cả ({totalUsers})
              </button>
              <button 
                onClick={() => setActiveFilter("pro")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeFilter === "pro" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Gói Pro ({proUsersCount})
              </button>
              <button 
                onClick={() => setActiveFilter("enterprise")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeFilter === "enterprise" ? "bg-purple-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Enterprise ({entUsersCount})
              </button>
              <button 
                onClick={() => setActiveFilter("free")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeFilter === "free" ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Cơ bản ({freeUsersCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Tìm kiếm email, họ tên, trường học..."
              />
            </div>
          </div>
          
          {/* Desktop & Tablet Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                <tr>
                  <th className="px-6 py-4">Tài khoản & Hồ sơ</th>
                  <th className="px-6 py-4">Liên lạc / Đơn vị</th>
                  <th className="px-6 py-4">Gói cước</th>
                  <th className="px-6 py-4">Trạng thái hạn dùng</th>
                  <th className="px-6 py-4 min-w-[340px]">Thay đổi nhanh thời hạn</th>
                  <th className="px-6 py-4 text-right">Tùy biến</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const status = getExpiryStatus(u);
                  const isCurrentEditing = editingId === u.id;
                  const isUserUpdating = updatingId === u.id;
                  
                  return (
                    <tr key={u.id} className={`hover:bg-slate-50/70 transition-colors ${isUserUpdating ? "bg-blue-50/30 animate-pulse" : ""}`}>
                      
                      {/* Avatar, Name and Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 border border-slate-200 shadow-sm shrink-0 uppercase">
                            {u.name?.[0] || u.email?.[0] || "G"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate flex items-center gap-1">
                              {u.name || "Chưa thiết lập"}
                              {u.email === "dodoan2211@gmail.com" && (
                                <span className="bg-red-50 text-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-100">Admin</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400" /> {u.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Contact and workplace */}
                      <td className="px-6 py-4">
                        <div className="text-xs space-y-1">
                          <p className="text-slate-800 font-semibold flex items-center gap-1">
                            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {u.workplace || "Chưa đăng ký"}
                          </p>
                          <p className="text-slate-500 flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {u.phone || "-"}
                          </p>
                        </div>
                      </td>

                      {/* Packages Badge */}
                      <td className="px-6 py-4">
                        {isCurrentEditing ? (
                          <select 
                            value={editPackage}
                            onChange={(e) => setEditPackage(e.target.value)}
                            className="border border-slate-200 rounded-lg p-1.5 text-xs bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="free">Cơ bản (Free)</option>
                            <option value="pro">Gói Pro (Premium)</option>
                            <option value="enterprise">Gói Enterprise</option>
                          </select>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                            u.package === 'enterprise' ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm' : 
                            u.package === 'pro' ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 
                            'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {u.package === 'enterprise' ? 'Enterprise' : u.package === 'pro' ? 'Pro' : 'Cơ bản'}
                          </span>
                        )}
                      </td>

                      {/* Status / Expiry Days Remaining */}
                      <td className="px-6 py-4">
                        {isCurrentEditing ? (
                          editPackage !== 'free' ? (
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="number" 
                                value={editDays}
                                onChange={(e) => setEditDays(Number(e.target.value))}
                                className="border border-slate-200 rounded-lg p-1.5 text-xs bg-white w-20 text-center font-bold"
                                min="1"
                                max="999"
                              />
                              <span className="text-xs text-slate-500 font-medium">ngày</span>
                            </div>
                          ) : <span className="text-xs text-slate-400 font-medium">-</span>
                        ) : (
                          <div className="space-y-1">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold border inline-block ${status.color}`}>
                              {status.label}
                            </span>
                            {u.expiresAt && u.package !== 'free' && (
                              <p className="text-[10px] text-slate-400 font-medium block">
                                Hết hạn: {new Date(u.expiresAt).toLocaleDateString('vi-VN')}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Quick Duration Override Buttons */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button 
                            disabled={isUserUpdating || isCurrentEditing}
                            onClick={() => handleQuickOverride(u.id, u.email, "pro", 30)}
                            className="px-2.5 py-1 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-50 hover:border-blue-300 disabled:opacity-40 transition-all flex items-center gap-1 shadow-sm"
                            title="Nâng cấp Pro thời hạn 30 ngày từ hôm nay"
                          >
                            +30 ngày Pro
                          </button>
                          <button 
                            disabled={isUserUpdating || isCurrentEditing}
                            onClick={() => handleQuickOverride(u.id, u.email, "pro", 90)}
                            className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-40 transition-all flex items-center gap-1 shadow-sm"
                            title="Nâng cấp Pro thời hạn 90 ngày từ hôm nay"
                          >
                            +90 ngày Pro
                          </button>
                          <button 
                            disabled={isUserUpdating || isCurrentEditing}
                            onClick={() => handleQuickOverride(u.id, u.email, "enterprise", 365)}
                            className="px-2.5 py-1 bg-white border border-purple-200 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-50 hover:border-purple-300 disabled:opacity-40 transition-all flex items-center gap-1 shadow-sm"
                            title="Nâng cấp Enterprise thời hạn 1 năm"
                          >
                            +365 ngày Ent
                          </button>
                          {u.package && u.package !== "free" && (
                            <button 
                              disabled={isUserUpdating || isCurrentEditing}
                              onClick={() => handleQuickOverride(u.id, u.email, "free", null)}
                              className="px-2.5 py-1 bg-white border border-slate-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 hover:border-red-200 disabled:opacity-40 transition-all shadow-sm"
                              title="Chuyển tài khoản về gói Miễn phí"
                            >
                              Hủy hạn
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Custom Customize button panel */}
                      <td className="px-6 py-4 text-right">
                        {isCurrentEditing ? (
                          <div className="flex justify-end gap-1.5">
                            <button 
                              disabled={isUserUpdating}
                              onClick={() => setEditingId(null)} 
                              className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                              title="Hủy"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button 
                              disabled={isUserUpdating}
                              onClick={() => handleSave(u.id, u.email)} 
                              className="p-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm flex items-center justify-center"
                              title="Lưu"
                            >
                              {isUserUpdating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <button 
                            disabled={isUserUpdating}
                            onClick={() => handleEdit(u)} 
                            className="p-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                            title="Chỉnh sửa thủ công"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>

                    </tr>
                  );
                })}
                
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Users className="w-8 h-8 text-slate-300" />
                        <p className="font-semibold text-sm">Không tìm thấy tài khoản giáo viên nào.</p>
                        <p className="text-xs text-slate-400">Hãy thử nhập từ khóa tìm kiếm hoặc lọc tab khác.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
        </div>
        )}

      </div>
    </Layout>
  );
}
