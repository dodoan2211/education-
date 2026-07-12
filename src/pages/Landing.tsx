import { useState, useEffect } from "react";
import { Link } from "react-router";
import { BookOpen, Calendar, MonitorPlay, Presentation, ArrowRight, CheckCircle2, Layout as LayoutIcon, Users, Shield, Zap, UserCircle, Plus, Send, Info, Sparkles, Check, Loader2, Settings, LogOut, ChevronDown, X, Coins, FlaskConical, Code, Cpu, BrainCircuit, PlusCircle, Download } from "lucide-react";
import { useAuth } from "../AuthContext";
import { useToast } from "../context/ToastContext";
import Dashboard from "./Dashboard";
import { db, auth, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, getDocs, query, orderBy, where, serverTimestamp, doc, setDoc, increment, runTransaction } from "firebase/firestore";
import { ConsignmentItem } from "../types";

import PaymentModal from "../components/PaymentModal";
import CommunityFeed from "../components/CommunityFeed";
import { STEMPortal, AIPortal, ArduinoPortal } from "../components/InfoPortals";

export default function Landing() {
  const [activeTab, setActiveTab] = useState<'home' | 'community' | 'store' | 'manager' | 'stem' | 'ai' | 'arduino'>('home');
  const { user, userProfile } = useAuth();

  // Handle direct links to community posts
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("post")) {
      setActiveTab('community');
    }
  }, []);
  const { toast } = useToast();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showConsignModal, setShowConsignModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("50000");
  const [billImage, setBillImage] = useState<string | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [isSubmittingRecharge, setIsSubmittingRecharge] = useState(false);
  const [rechargeSuccess, setRechargeSuccess] = useState(false);

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

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;
    
    const amountNum = Number(rechargeAmount);
    if (isNaN(amountNum) || amountNum < 10000) {
      toast.error("Số tiền nạp tối thiểu là 10,000đ!");
      return;
    }

    if (!billImage) {
      toast.error("Vui lòng tải lên ảnh chụp màn hình chuyển khoản (Bill)!");
      return;
    }

    setIsSubmittingRecharge(true);
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
      toast.error("Đã xảy ra lỗi, vui lòng thử lại!");
    } finally {
      setIsSubmittingRecharge(false);
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
  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  // Payment / Upgrade states
  const [selectedPackage, setSelectedPackage] = useState<{
    key: string;
    label: string;
    price: string;
    days: number;
  } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Consignment & Store states
  const [consignments, setConsignments] = useState<ConsignmentItem[]>([]);
  const [purchasedItemIds, setPurchasedItemIds] = useState<string[]>([]);
  const [loadingStore, setLoadingStore] = useState(false);
  const [consignTitle, setConsignTitle] = useState("");
  const [consignDesc, setConsignDesc] = useState("");
  const [consignContent, setConsignContent] = useState("");
  const [consignPrice, setConsignPrice] = useState("50000");
  const [consignType, setConsignType] = useState("lesson_plan");
  const [consigning, setConsigning] = useState(false);
  const [consignSuccess, setConsignSuccess] = useState("");
  const [previewItem, setPreviewItem] = useState<ConsignmentItem | null>(null);
  const [consignFile, setConsignFile] = useState<string | null>(null);
  const [consignFileName, setConsignFileName] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const defaultItems: ConsignmentItem[] = [
    {
      id: "seed-1",
      userId: "system",
      teacherName: "Nguyễn Thị A",
      title: "Giáo án Ngữ Văn 10 - KNTT",
      description: "Trọn bộ giáo án PowerPoint và Word môn Ngữ Văn lớp 10 theo chương trình mới Kết nối tri thức.",
      content: "Nội dung giáo án Ngữ Văn 10... Phần 1: Đọc hiểu văn bản. Phần 2: Thực hành tiếng Việt. Phần 3: Viết bài văn nghị luận. Phần 4: Nói và nghe. Đây là bộ giáo án được soạn thảo kỹ lưỡng bám sát khung chương trình mới.",
      type: "lesson_plan",
      price: 50000,
      createdAt: null
    },
    {
      id: "seed-2",
      userId: "system",
      teacherName: "Trần Văn B",
      title: "Slide Bài giảng Toán 12",
      description: "Hệ thống bài giảng Toán 12 trực quan sinh động, kèm bài tập trắc nghiệm và lời giải chi tiết.",
      content: "Nội dung bài giảng Toán 12: Chương 1: Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số. Chương 2: Hàm số lũy thừa, hàm số mũ và hàm số logarit. Chương 3: Nguyên hàm, tích phân và ứng dụng. Chương 4: Số phức.",
      type: "video",
      price: 120000,
      createdAt: null
    },
    {
      id: "seed-3",
      userId: "system",
      teacherName: "Lê Thị C",
      title: "Kế hoạch chủ nhiệm lớp 6",
      description: "Mẫu kế hoạch công tác giáo viên chủ nhiệm lớp 6 chi tiết cho cả năm học, file Word dễ chỉnh sửa.",
      content: "Kế hoạch chủ nhiệm lớp 6 bao gồm: Đặc điểm tình hình lớp. Mục tiêu, chỉ tiêu phấn đấu. Các biện pháp thực hiện. Kế hoạch cụ thể từng tháng từ tháng 9 đến tháng 5 năm sau.",
      type: "plan",
      price: 0,
      createdAt: null
    }
  ];

  const fetchConsignments = async () => {
    setLoadingStore(true);
    try {
      const q = query(collection(db, "consignments"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items: ConsignmentItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as ConsignmentItem);
      });
      setConsignments(items);
    } catch (error) {
      console.error("Lỗi tải danh mục ký gửi:", error);
    } finally {
      setLoadingStore(false);
    }
  };

  const fetchPurchasedItemIds = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid),
        where("type", "==", "purchase")
      );
      const snapshot = await getDocs(q);
      const ids: string[] = [];
      snapshot.forEach((doc) => {
        ids.push(doc.data().itemId);
      });
      setPurchasedItemIds(ids);
    } catch (error) {
      console.error("Lỗi tải lịch sử mua:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "store") {
      fetchConsignments();
      fetchPurchasedItemIds();
    }
  }, [activeTab, user]);

  const handleConsignFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 
        'image/png', 
        'image/webp'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast.error("Chỉ chấp nhận file PDF, Word hoặc Hình ảnh!");
        return;
      }

      // Check file size (max 5MB for base64 storage)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File quá lớn! Vui lòng chọn file dưới 5MB.");
        return;
      }

      setIsUploadingFile(true);
      setConsignFileName(file.name);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setConsignFile(reader.result as string);
        setIsUploadingFile(false);
      };
      reader.onerror = () => {
        toast.error("Lỗi khi đọc file!");
        setIsUploadingFile(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConsignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!consignTitle.trim() || !consignDesc.trim()) return;

    if (!consignFile) {
      toast.error("Vui lòng tải lên file tài liệu (PDF, Word hoặc Hình ảnh)!");
      return;
    }

    setConsigning(true);
    setConsignSuccess("");
    try {
      await addDoc(collection(db, "consignments"), {
        userId: user.uid,
        teacherName: userProfile?.name || user.displayName || user.email || "Giáo viên ẩn danh",
        title: consignTitle,
        description: consignDesc,
        content: consignContent,
        price: Number(consignPrice) || 0,
        type: consignType,
        fileUrl: consignFile, // Storing as base64
        fileName: consignFileName,
        createdAt: serverTimestamp()
      });

      setConsignTitle("");
      setConsignDesc("");
      setConsignContent("");
      setConsignPrice("50000");
      setConsignFile(null);
      setConsignFileName("");
      setConsignSuccess("Gửi ký gửi tài liệu thành công! Tài liệu đã được hiển thị trên Chợ tài liệu.");
      setTimeout(() => {
        setConsignSuccess("");
        setShowConsignModal(false);
      }, 3000);
      fetchConsignments();
    } catch (error) {
      console.error("Lỗi ký gửi tài liệu:", error);
    } finally {
      setConsigning(false);
    }
  };

  const handlePurchaseItem = async (item: ConsignmentItem) => {
    if (!user || !userProfile) {
      toast.error("Vui lòng đăng nhập để mua tài liệu!");
      return;
    }

    if (item.userId === user.uid) {
      toast.error("Bạn không thể mua tài liệu của chính mình!");
      return;
    }

    const currentCoins = userProfile.coins || 0;
    if (currentCoins < item.price) {
      toast.error("Bạn không đủ Coin để mua tài liệu này. Vui lòng nạp thêm!");
      setShowRechargeModal(true);
      // Auto-set recharge amount to at least the price difference
      const needed = item.price - currentCoins;
      if (needed > 0) {
        setRechargeAmount(Math.max(10000, Math.ceil(needed / 1000) * 1000).toString());
      }
      return;
    }

    try {
      // Use a Firestore transaction for atomic coin transfer
      await runTransaction(db, async (transaction) => {
        const buyerRef = doc(db, "users", user.uid);
        const buyerSnap = await transaction.get(buyerRef);
        
        if (!buyerSnap.exists()) {
          throw new Error("Người dùng không tồn tại!");
        }
        
        const currentBuyerCoins = buyerSnap.data().coins || 0;
        if (currentBuyerCoins < item.price) {
          throw new Error("Insufficient coins");
        }

        // 1. Deduct coins from buyer
        transaction.set(buyerRef, {
          coins: increment(-item.price)
        }, { merge: true });

        // 2. Increase coins for seller (if not system)
        if (item.userId !== "system") {
          const sellerRef = doc(db, "users", item.userId);
          transaction.set(sellerRef, {
            coins: increment(item.price)
          }, { merge: true });
        }

        // 3. Record the purchase transaction
        const txRef = doc(collection(db, "transactions"));
        transaction.set(txRef, {
          userId: user.uid,
          userName: userProfile.name || "Giáo viên",
          userEmail: user.email,
          amount: item.price,
          type: "purchase",
          status: "completed",
          itemId: item.id,
          itemTitle: item.title,
          sellerId: item.userId,
          fileUrl: item.fileUrl || null,
          createdAt: serverTimestamp()
        });

        // 4. Create notification for seller
        if (item.userId !== "system") {
          const sellerNotifRef = doc(collection(db, "notifications"));
          transaction.set(sellerNotifRef, {
            userId: item.userId,
            type: "consignment_purchase",
            title: "Tài liệu được mua!",
            message: `Tài liệu "${item.title}" của bạn vừa được mua. Bạn nhận được +${item.price.toLocaleString()} Coin.`,
            createdAt: serverTimestamp(),
            read: false,
            amount: item.price,
            docName: item.title
          });
        }
      });

      toast.success(`Mua tài liệu thành công! Bạn đã thanh toán ${item.price.toLocaleString()} Coin.`);
      
      // Auto download after purchase
      if (item.fileUrl) {
        const link = document.createElement('a');
        link.href = item.fileUrl;
        link.download = item.fileName || item.title || 'Tai_lieu_da_mua';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error: any) {
      console.error("Lỗi thanh toán mua tài liệu:", error);
      if (error?.message === "Insufficient coins") {
        toast.error("Bạn không đủ Coin để mua tài liệu này. Vui lòng nạp thêm!");
      } else {
        toast.error("Có lỗi xảy ra khi thanh toán. Vui lòng thử lại.");
      }
    }
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
                onClick={() => setActiveTab('store')} 
                className={`text-sm font-medium transition-colors ${activeTab === 'store' ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Thư viện
              </button>
              {user && (
                <Link 
                  to="/dashboard" 
                  className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors"
                >
                  Trình quản lí
                </Link>
              )}
            </div>
            <div className="flex items-center space-x-4">
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
                    <Plus className="w-4 h-4" />
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
                        {/* Upgrade section */}
                        <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 flex flex-col gap-1.5 shrink-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gói hiện tại</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              userProfile?.package === 'admin' ? 'bg-red-100 text-red-600' :
                              userProfile?.package === 'pro' ? 'bg-blue-100 text-blue-600' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {userProfile?.package === 'admin' ? 'Admin' :
                               userProfile?.package === 'pro' ? 'Pro' : 'Cơ bản'}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setSelectedPackage({ key: 'pro', label: '1 Tháng (Pro)', price: '80.000đ', days: 30 });
                            }}
                            className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm shadow-blue-100 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-blue-200 animate-pulse" />
                            {userProfile?.package === 'pro' ? 'Gia hạn gói Pro' : 'Nâng cấp lên Pro'}
                          </button>
                        </div>

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
            
            {/* Abstract background graphics */}
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

        {/* Store Tab */}
        {activeTab === 'store' && (
          <section className="py-20 bg-slate-50 min-h-[calc(100vh-160px)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 pb-6 border-b border-slate-200">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Hệ thống mua bán an toàn real-time
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">Chợ tài liệu & Ký gửi</h2>
                  <p className="text-base text-slate-600 max-w-2xl">Khám phá và ký gửi các giáo án, tài liệu chất lượng cao từ cộng đồng giáo viên.</p>
                </div>
                <button 
                  onClick={() => setShowConsignModal(true)}
                  className="w-full md:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2 group shrink-0 cursor-pointer"
                >
                  <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Ký gửi tài liệu ngay
                </button>
              </div>

              {loadingStore ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : consignments.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                  <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FlaskConical className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Chưa có tài liệu ký gửi</h3>
                  <p className="text-slate-500 max-w-sm mx-auto mb-6">Hãy là người đầu tiên ký gửi tài liệu chất lượng để chia sẻ với cộng đồng giáo viên!</p>
                  <button 
                    onClick={() => setShowConsignModal(true)}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all cursor-pointer"
                  >
                    Ký gửi ngay
                  </button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Display real items only */}
                  {consignments.map((item, index) => {
                    const isOwnItem = user && item.userId === user.uid;
                    return (
                      <div key={item.id || index} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow relative">
                        {isOwnItem && (
                          <span className="absolute top-3 right-3 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1 z-10">
                            <Check className="w-3.5 h-3.5" /> Tài liệu của bạn
                          </span>
                        )}
                        <div className="p-6 flex-1">
                          <div className="flex justify-between items-start mb-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border shrink-0 ${
                              item.type === 'lesson_plan' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                              item.type === 'video' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                              item.type === 'plan' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                              'bg-amber-50 border-amber-100 text-amber-600'
                            }`}>
                              {item.type === 'lesson_plan' && <BookOpen className="w-5 h-5" />}
                              {item.type === 'video' && <Presentation className="w-5 h-5" />}
                              {item.type === 'plan' && <Calendar className="w-5 h-5" />}
                              {item.type === 'digital' && <MonitorPlay className="w-5 h-5" />}
                            </div>
                            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-md border border-blue-200">
                              {item.price > 0 ? `${item.price.toLocaleString('vi-VN')} Coin` : 'Miễn phí'}
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-1">{item.title}</h3>
                          <p className="text-sm text-slate-500 mb-4 line-clamp-2">{item.description}</p>
                          
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-auto pt-2 border-t border-slate-50">
                            <UserCircle className="w-4 h-4 text-slate-400" />
                            <span>Giáo viên: <b>{item.teacherName}</b></span>
                          </div>
                        </div>
                        
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-2">
                          <button 
                            onClick={() => setPreviewItem(item)}
                            className="flex-1 bg-white border border-slate-200 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                          >
                            Xem thử
                          </button>
                          {!user ? (
                            <Link to="/login" className="flex-1 bg-blue-600 text-white text-center py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                              Đăng nhập
                            </Link>
                          ) : isOwnItem ? (
                            <button 
                              disabled
                              className="flex-1 bg-slate-100 text-slate-400 text-center py-2 rounded-lg text-sm font-medium border border-slate-200 cursor-not-allowed"
                            >
                              Tài liệu của bạn
                            </button>
                          ) : purchasedItemIds.includes(item.id) ? (
                            <Link 
                              to="/profile"
                              className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5" /> Đã mua - Tải về
                            </Link>
                          ) : (
                            <button 
                              onClick={() => handlePurchaseItem(item)}
                              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Coins className="w-3.5 h-3.5" /> Mua ngay
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div className="mt-12 text-center bg-blue-50 border border-blue-100 p-6 rounded-2xl max-w-xl mx-auto">
                <p className="text-blue-800 font-medium mb-3">Thầy cô có tài liệu hay muốn chia sẻ và tạo thu nhập?</p>
                <button 
                  onClick={() => setShowConsignModal(true)} 
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Gửi ký gửi tài liệu ngay
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Manager Tab */}
        {activeTab === 'manager' && user && (
          <section className="py-20 bg-slate-50 min-h-[calc(100vh-160px)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-12">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Trình quản lý hệ thống</h2>
                <p className="text-slate-600">Truy cập nhanh các công cụ và tài nguyên của bạn.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Link to="/tool/lesson_plan" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col items-start">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">Soạn Giáo Án AI</h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">Tạo giáo án chi tiết theo chuẩn của Bộ Giáo dục & Đào tạo.</p>
                  <span className="mt-auto text-blue-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">Sử dụng ngay <ArrowRight className="w-4 h-4" /></span>
                </Link>

                <Link to="/tool/plan" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col items-start">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">Lập Kế Hoạch</h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">Tạo kế hoạch giảng dạy, kế hoạch chủ nhiệm chuyên nghiệp.</p>
                  <span className="mt-auto text-indigo-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">Sử dụng ngay <ArrowRight className="w-4 h-4" /></span>
                </Link>

                <Link to="/tool/digital" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col items-start">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <MonitorPlay className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">Chuyển Đổi Số</h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">Số hóa tài liệu, tạo câu hỏi trắc nghiệm tự động.</p>
                  <span className="mt-auto text-emerald-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">Sử dụng ngay <ArrowRight className="w-4 h-4" /></span>
                </Link>

                <Link to="/tool/video" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col items-start">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Presentation className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">AI Video Studio</h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">Tạo video bài giảng chuyên nghiệp với giảng viên ảo.</p>
                  <span className="mt-auto text-purple-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">Sử dụng ngay <ArrowRight className="w-4 h-4" /></span>
                </Link>

                <Link to="/tool/stem" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col items-start">
                  <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FlaskConical className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">STEM Lab AI</h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">Thiết kế thí nghiệm và dự án STEM sáng tạo cho học sinh.</p>
                  <span className="mt-auto text-rose-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">Sử dụng ngay <ArrowRight className="w-4 h-4" /></span>
                </Link>

                <Link to="/tool/code" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col items-start">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Code className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">Lập Trình & Thuật Toán</h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">Hỗ trợ giảng dạy lập trình và tư duy thuật toán thông minh.</p>
                  <span className="mt-auto text-blue-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">Sử dụng ngay <ArrowRight className="w-4 h-4" /></span>
                </Link>

                <Link to="/tool/arduino" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col items-start">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">Arduino & IoT</h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">Hướng dẫn lập trình nhúng và thiết kế hệ thống IoT.</p>
                  <span className="mt-auto text-amber-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">Sử dụng ngay <ArrowRight className="w-4 h-4" /></span>
                </Link>

                <Link to="/tool/ai_lab" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col items-start">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <BrainCircuit className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">AI Research Lab</h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">Nghiên cứu và ứng dụng trí tuệ nhân tạo thế hệ mới.</p>
                  <span className="mt-auto text-indigo-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">Sử dụng ngay <ArrowRight className="w-4 h-4" /></span>
                </Link>
              </div>
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

      {/* Recharge Coin Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto">
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
                      <Info className="w-4 h-4" /> Thông tin thanh toán (Admin)
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
                      disabled={isSubmittingRecharge}
                      className="flex-[2] px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingRecharge ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
                      {isSubmittingRecharge ? "Đang gửi..." : "Xác nhận nạp Coin"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Billing Modal */}
      {selectedPackage && (
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
      )}
      
      {/* Success State Overlay */}
      {paymentSuccess && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden relative flex flex-col p-8 text-center items-center justify-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100 mb-4 animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Gửi yêu cầu thành công!</h3>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              Hệ thống đã nhận được biên lai của thầy cô. Quản trị viên sẽ duyệt và kích hoạt gói <b>{selectedPackage?.label || "dịch vụ"}</b> trong thời gian sớm nhất.
            </p>
          </div>
        </div>
      )}

      {/* Sleek Consignment Modal */}
      {showConsignModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl relative overflow-hidden my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
                  <Send className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Ký gửi học liệu mới</h3>
                  <p className="text-xs text-slate-400 font-medium">Chia sẻ tài nguyên chất lượng của thầy cô lên Chợ</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowConsignModal(false);
                  setConsignSuccess("");
                }}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {user ? (
                <form onSubmit={handleConsignSubmit} className="space-y-4">
                  {consignSuccess && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-start gap-2.5 mb-4 animate-fade-in">
                      <Check className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Thành công!</p>
                        <p className="text-xs text-emerald-500/80 mt-0.5">{consignSuccess}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tên tài liệu / giáo án *</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ví dụ: Giáo án Ngữ Văn 11 - Kết nối tri thức"
                      className="w-full bg-slate-800 border border-slate-750 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      value={consignTitle}
                      onChange={(e) => setConsignTitle(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Loại học liệu</label>
                      <select 
                        className="w-full bg-slate-800 border border-slate-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        value={consignType}
                        onChange={(e) => setConsignType(e.target.value)}
                      >
                        <option value="lesson_plan">Giáo án</option>
                        <option value="video">Bài giảng Slide</option>
                        <option value="plan">Kế hoạch giảng dạy</option>
                        <option value="digital">Đề trắc nghiệm</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Định giá (VNĐ) *</label>
                      <input 
                        type="number"
                        required
                        min="0"
                        step="5000"
                        className="w-full bg-slate-800 border border-slate-750 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        value={consignPrice}
                        onChange={(e) => setConsignPrice(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tải lên tệp tài liệu (PDF, Word, Ảnh) *</label>
                    <div className="relative group">
                      <input 
                        type="file"
                        required
                        accept=".pdf,.doc,.docx,image/*"
                        onChange={handleConsignFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${consignFile ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-750 bg-slate-800/50 hover:border-blue-500/30'}`}>
                        {isUploadingFile ? (
                          <div className="flex items-center justify-center gap-2 py-2">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                            <span className="text-sm text-slate-400 font-medium">Đang xử lý tệp...</span>
                          </div>
                        ) : consignFile ? (
                          <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                              </div>
                              <div className="text-left overflow-hidden">
                                <p className="text-xs font-bold text-white truncate">{consignFileName}</p>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">Sẵn sàng gửi</p>
                              </div>
                            </div>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConsignFile(null);
                                setConsignFileName("");
                              }}
                              className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-red-400 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 py-2">
                            <Download className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                            <p className="text-xs text-slate-400 font-medium">Nhấn hoặc kéo thả tệp vào đây</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-tighter">PDF, Word, JPG, PNG (Max 5MB)</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Mô tả tóm tắt *</label>
                    <textarea 
                      required
                      rows={2}
                      placeholder="Mô tả tóm tắt nội dung giáo án, số trang, định dạng..."
                      className="w-full bg-slate-800 border border-slate-750 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      value={consignDesc}
                      onChange={(e) => setConsignDesc(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nội dung chi tiết (Dùng để người mua xem thử 1/3) *</label>
                    <textarea 
                      required
                      rows={6}
                      placeholder="Dán toàn bộ nội dung tài liệu của thầy cô vào đây..."
                      className="w-full bg-slate-800 border border-slate-750 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none font-mono"
                      value={consignContent}
                      onChange={(e) => setConsignContent(e.target.value)}
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowConsignModal(false);
                        setConsignSuccess("");
                      }}
                      className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button 
                      type="submit"
                      disabled={consigning}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {consigning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" /> Gửi ký gửi
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="py-8 text-center">
                  <Info className="w-12 h-12 text-slate-500 mx-auto mb-3 animate-pulse" />
                  <p className="text-slate-300 text-sm mb-6 max-w-sm mx-auto">Thầy cô cần đăng nhập tài khoản EduCreate để thực hiện ký gửi tài liệu của mình.</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => setShowConsignModal(false)}
                      className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Để sau
                    </button>
                    <Link 
                      to="/login" 
                      onClick={() => setShowConsignModal(false)}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors"
                    >
                      Đăng nhập ngay
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Document Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl relative overflow-hidden my-8 border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                  previewItem.type === 'lesson_plan' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                  previewItem.type === 'video' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                  previewItem.type === 'plan' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                  'bg-amber-50 border-amber-100 text-amber-600'
                }`}>
                  {previewItem.type === 'lesson_plan' && <BookOpen className="w-5 h-5" />}
                  {previewItem.type === 'video' && <Presentation className="w-5 h-5" />}
                  {previewItem.type === 'plan' && <Calendar className="w-5 h-5" />}
                  {previewItem.type === 'digital' && <MonitorPlay className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{previewItem.title}</h3>
                  <p className="text-xs text-slate-500 font-medium">Bản xem thử tài liệu của thầy cô: {previewItem.teacherName}</p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewItem(null)}
                className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors border border-slate-200 shadow-sm cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {/* Description Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" /> Mô tả nội dung
                </h4>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm text-slate-700 leading-relaxed italic">
                  {previewItem.description}
                </div>
              </div>

              {/* Content Preview (1/3) Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Nội dung xem trước
                  </span>
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Preview</span>
                </h4>
                <div className="bg-white border border-slate-200 rounded-xl p-5 relative overflow-hidden">
                  {previewItem.fileUrl && previewItem.fileUrl.startsWith('data:image/') ? (
                    <div className="relative max-h-48 overflow-hidden select-none">
                      <img src={previewItem.fileUrl} alt="Preview" className="w-full h-auto object-cover" draggable={false} />
                    </div>
                  ) : (
                    <div className="text-sm text-slate-800 font-mono whitespace-pre-wrap leading-relaxed select-none">
                      {previewItem.content 
                        ? previewItem.content.substring(0, Math.ceil(previewItem.content.length / 3)) + "..."
                        : "Tài liệu này không có nội dung văn bản để xem trước."
                      }
                    </div>
                  )}
                  
                  {/* Blur effect at the bottom of preview */}
                  <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none flex items-end justify-center pb-4 backdrop-blur-[2px]">
                    <div className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-xs font-bold border border-blue-100 shadow-sm flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" /> Nội dung bị ẩn - Vui lòng mua để xem toàn bộ
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giá bán</span>
                <span className="text-xl font-black text-blue-600 flex items-center gap-1.5">
                  <Coins className="w-5 h-5 text-amber-500" />
                  {previewItem.price > 0 ? `${previewItem.price.toLocaleString('vi-VN')} Coin` : 'Miễn phí'}
                </span>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setPreviewItem(null)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Đóng lại
                </button>
                {!user ? (
                  <Link 
                    to="/login"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100 flex items-center gap-2 transition-all"
                  >
                    Đăng nhập để mua
                  </Link>
                ) : user.uid === previewItem.userId ? (
                  <button 
                    disabled
                    className="px-8 py-2.5 bg-slate-100 text-slate-400 rounded-xl text-sm font-bold flex items-center gap-2 cursor-not-allowed"
                  >
                    Tài liệu của bạn
                  </button>
                ) : purchasedItemIds.includes(previewItem.id) ? (
                  <Link 
                    to="/profile"
                    className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-100 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Đã mua - Tải về
                  </Link>
                ) : (
                  <button 
                    onClick={() => {
                      handlePurchaseItem(previewItem);
                      setPreviewItem(null);
                    }}
                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Coins className="w-4 h-4" /> Mua ngay
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
