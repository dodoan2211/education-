import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { Trophy, Calendar, Award, BookOpen, Send, CheckCircle2, RefreshCw, Sparkles, AlertCircle, Eye, FileText, ChevronRight, X } from "lucide-react";
import { db } from "../firebase";
import { collection, addDoc, query, where, serverTimestamp, onSnapshot, orderBy } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { useToast } from "../context/ToastContext";

interface Competition {
  id: string;
  title: string;
  description: string;
  rules: string;
  type: string;
  date: string;
  status: "Đang diễn ra" | "Sắp diễn ra" | "Đã kết thúc";
  createdAt?: any;
}

interface UserResource {
  id: string;
  title: string;
  type: string;
  content: string;
}

interface Submission {
  id: string;
  competitionId: string;
  competitionTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  resourceId: string;
  resourceTitle: string;
  resourceContent: string;
  submittedAt: any;
  status: "Chờ chấm điểm" | "Đã chấm điểm";
  grade?: string;
  comment?: string;
}

const DEFAULT_COMPETITIONS: Omit<Competition, "id">[] = [
  {
    title: "Thiết kế bài dạy số chuẩn sư phạm 2026",
    description: "Cuộc thi thúc đẩy giáo viên ứng dụng các phương pháp giảng dạy hiện đại và Công văn 5512 để kiến tạo giáo án đạt chuẩn phát triển năng lực học sinh thế hệ mới.",
    rules: "1. Bài dự thi phải được soạn thảo hoàn chỉnh trên nền tảng EduCreate Workspace.\n2. Giáo án phải bao gồm đủ cấu phần tiến trình 4 hoạt động sư phạm.\n3. Phù hợp chương trình giáo dục phổ thông mới.",
    type: "STEM / Tự nhiên",
    date: "01/10/2026 - 31/12/2026",
    status: "Đang diễn ra"
  },
  {
    title: "Sáng kiến Lập kế hoạch Chuyển đổi số Nhà trường",
    description: "Nhằm tìm kiếm các đề xuất chuyển đổi số khả thi và đột phá cho các nhà trường từ cấp mầm non đến trung học phổ thông, nâng tầm quản trị số.",
    rules: "1. Kế hoạch phải bao gồm tối thiểu 3 cấu phần: Hiện trạng, giải pháp hạ tầng, và lộ trình huấn luyện giáo viên.\n2. Dự toán ngân sách và giải pháp tài chính phải khả thi.",
    type: "Công nghệ số",
    date: "15/10/2026 - 15/01/2027",
    status: "Đang diễn ra"
  },
  {
    title: "Thiết kế Infographic bài học trực quan sinh động",
    description: "Vinh danh những infographic bài giảng xuất sắc nhất, giúp học sinh tóm tắt kiến thức siêu tốc qua sơ đồ, biểu đồ và hình ảnh chất lượng cao.",
    rules: "1. Tác phẩm dự thi là Infographic được kết xuất hoàn chỉnh từ EduCreate Infographic Maker.\n2. Nội dung chính xác khoa học, trình bày có tính thẩm mỹ cao.",
    type: "Đồ họa Giáo dục",
    date: "10/11/2026 - 20/02/2027",
    status: "Sắp diễn ra"
  }
];

export default function Competitions() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  
  // Submission flow states
  const [myResources, setMyResources] = useState<UserResource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    const q = query(collection(db, "competitions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let items: Competition[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Competition);
      });

      // Seed default items if Firestore is completely empty
      if (items.length === 0) {
        // We can't easily seed here with onSnapshot without triggering infinite loop or extra writes
        // So we just use the default list if nothing is in DB
        items = DEFAULT_COMPETITIONS.map((c, idx) => ({ id: `default-comp-${idx}`, ...c } as Competition));
      }
      setCompetitions(items);
      setLoading(false);
    }, (error) => {
      console.error("Lỗi real-time cuộc thi:", error);
      setCompetitions(DEFAULT_COMPETITIONS.map((c, idx) => ({ id: `default-comp-${idx}`, ...c } as Competition)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setMyResources([]);
      setMySubmissions([]);
      return;
    }

    // 1. Fetch user saved resources (real-time)
    const qResources = query(collection(db, "resources"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribeResources = onSnapshot(qResources, (snapshot) => {
      const resItems: UserResource[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        resItems.push({
          id: doc.id,
          title: data.title || "Tài liệu không tên",
          type: data.type || "Chưa phân loại",
          content: data.content || ""
        });
      });
      setMyResources(resItems);
    }, (error) => {
      console.error("Lỗi real-time tài nguyên:", error);
    });

    // 2. Fetch user existing submissions (real-time)
    const qSubmissions = query(collection(db, "submissions"), where("userId", "==", user.uid), orderBy("submittedAt", "desc"));
    const unsubscribeSubmissions = onSnapshot(qSubmissions, (snapshot) => {
      const subItems: Submission[] = [];
      snapshot.forEach((doc) => {
        subItems.push({ id: doc.id, ...doc.data() } as Submission);
      });
      setMySubmissions(subItems);
    }, (error) => {
      console.error("Lỗi real-time bài nộp:", error);
    });

    return () => {
      unsubscribeResources();
      unsubscribeSubmissions();
    };
  }, [user]);

  const handleOpenDetail = (comp: Competition) => {
    setSelectedComp(comp);
    setSelectedResourceId("");
  };

  const handleSubmitEntry = async () => {
    if (!user || !selectedComp) return;
    if (!selectedResourceId) {
      toast.warning("Vui lòng chọn một tài liệu từ kho cá nhân của thầy cô để nộp bài!");
      return;
    }

    const selectedRes = myResources.find(r => r.id === selectedResourceId);
    if (!selectedRes) {
      toast.error("Tài liệu không hợp lệ.");
      return;
    }

    // Check if already submitted for this competition
    const alreadySubmitted = mySubmissions.some(sub => sub.competitionId === selectedComp.id);
    if (alreadySubmitted) {
      toast.warning("Thầy cô đã nộp bài dự thi cho cuộc thi này rồi!");
      return;
    }

    setSubmitting(true);
    try {
      const submissionData = {
        competitionId: selectedComp.id,
        competitionTitle: selectedComp.title,
        userId: user.uid,
        userName: userProfile?.name || user.displayName || user.email?.split("@")[0] || "Giáo viên",
        userEmail: user.email || "",
        resourceId: selectedRes.id,
        resourceTitle: selectedRes.title,
        resourceContent: selectedRes.content,
        status: "Chờ chấm điểm" as const,
        submittedAt: serverTimestamp()
      };

      await addDoc(collection(db, "submissions"), submissionData);

      // Add real-time notification
      await addDoc(collection(db, "notifications"), {
        userId: user.uid,
        type: "competition",
        title: "Nộp bài dự thi thành công!",
        message: `Hệ thống đã ghi nhận bài dự thi "${selectedRes.title}" của thầy cô cho cuộc thi "${selectedComp.title}".`,
        createdAt: serverTimestamp(),
        read: false
      });

      toast.success("Đã gửi bài thi thành công! Chúc thầy cô đạt kết quả cao.");
      
      setSelectedComp(null);
    } catch (err) {
      console.error("Lỗi gửi bài thi:", err);
      toast.error("Gặp lỗi trong quá trình nộp bài dự thi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-8 rounded-3xl relative overflow-hidden shadow-lg border border-slate-800">
          <div className="absolute top-0 right-0 transform translate-x-20 -translate-y-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-md">
              <Trophy className="w-7 h-7 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-black font-display tracking-tight flex items-center gap-2">
                Hội Thi Chuyên Môn <span className="bg-amber-400/20 text-amber-300 text-[11px] font-bold px-2 py-0.5 rounded border border-amber-400/30">EduCreate</span>
              </h1>
              <p className="text-slate-300 font-semibold text-sm mt-1">Cổng nộp bài dự thi dành cho giáo viên và sáng kiến chuyển đổi số trường học</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-white/50 font-medium bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 relative z-10">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Dữ liệu trực tuyến
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-80 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
            <p className="text-slate-500 text-sm font-semibold">Đang nạp danh sách các hội thi...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left side: Competitions List */}
            <div className="lg:col-span-8 space-y-6">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" /> Danh sách Hội thi đang diễn ra
              </h2>

              <div className="grid grid-cols-1 gap-6">
                {competitions.map((comp) => {
                  const alreadySubmitted = mySubmissions.find(sub => sub.competitionId === comp.id);
                  return (
                    <div 
                      key={comp.id} 
                      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            comp.status === 'Đang diễn ra' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                            comp.status === 'Sắp diễn ra' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-50 text-slate-500 border border-slate-200'
                          }`}>
                            {comp.status}
                          </span>
                          <span className="bg-slate-50 text-slate-600 border border-slate-100 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">
                            {comp.type}
                          </span>
                        </div>
                        
                        {alreadySubmitted && (
                          <span className="flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Đã nộp bài
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{comp.title}</h3>
                      <p className="text-slate-500 text-xs font-semibold leading-relaxed mb-4 line-clamp-2">{comp.description}</p>
                      
                      <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Thời gian: <b className="text-slate-700">{comp.date}</b>
                        </span>

                        <button 
                          onClick={() => handleOpenDetail(comp)}
                          className="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all flex items-center gap-1"
                        >
                          Xem & Dự thi <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right side: Teacher's submission records */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Award className="w-5 h-5 text-blue-600" /> Hồ sơ dự thi của thầy cô
                </h3>

                {!user ? (
                  <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    Đăng nhập tài khoản để quản lý và gửi bài dự thi.
                  </div>
                ) : mySubmissions.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs font-semibold leading-relaxed">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    Thầy cô chưa nộp bài dự thi nào. Hãy nộp sáng kiến giáo án hoặc kế hoạch của mình!
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {mySubmissions.map((sub) => (
                      <div key={sub.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">{sub.competitionTitle}</p>
                        <h4 className="text-xs font-bold text-slate-800 truncate">{sub.resourceTitle}</h4>
                        <div className="flex items-center justify-between text-[10px] border-t border-slate-200/50 pt-2 flex-wrap gap-1">
                          <span className={`font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            sub.status === "Chờ chấm điểm" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {sub.status}
                          </span>
                          {sub.grade && (
                            <span className="font-bold text-rose-600">Đạt: <b>{sub.grade}</b></span>
                          )}
                        </div>
                        {sub.comment && (
                          <p className="bg-white p-2 rounded border border-slate-100 text-[10px] font-semibold italic text-slate-600 mt-1.5 leading-snug">
                            <b>Nhận xét:</b> {sub.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Modal: Slide-over Detail & Submission */}
        {selectedComp && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
              {/* Header */}
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="font-black text-slate-800 text-base">Chi tiết cuộc thi</h3>
                </div>
                <button 
                  onClick={() => setSelectedComp(null)}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
                <div>
                  <h2 className="text-lg font-black text-slate-900 mb-2">{selectedComp.title}</h2>
                  <p className="text-xs font-semibold text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {selectedComp.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-500" /> Thể lệ cuộc thi & Yêu cầu bài nộp
                  </h4>
                  <p className="text-xs font-semibold text-slate-600 whitespace-pre-wrap leading-relaxed bg-rose-50/30 p-4 rounded-xl border border-rose-100/40">
                    {selectedComp.rules}
                  </p>
                </div>

                {/* Submission Selector */}
                {user ? (
                  <div className="border-t border-slate-200 pt-6 space-y-4">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <Send className="w-4 h-4 text-blue-600 animate-bounce" /> Chọn bài viết để nộp dự thi
                    </h4>
                    
                    {myResources.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs font-semibold text-amber-800 leading-relaxed">
                        Thầy cô hiện chưa có tài liệu nào được lưu trong kho cá nhân. Hãy tạo giáo án, kế hoạch hoặc infographic mới ở mục Workspace và bấm "Lưu trữ" để nộp dự thi tại đây!
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-500">Tài liệu đã lưu trong tài khoản của thầy cô:</label>
                        <select
                          value={selectedResourceId}
                          onChange={(e) => setSelectedResourceId(e.target.value)}
                          className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm cursor-pointer"
                        >
                          <option value="">-- Bấm để chọn tài liệu dự thi --</option>
                          {myResources.map(res => (
                            <option key={res.id} value={res.id}>
                              [{res.type.toUpperCase()}] {res.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-100 text-slate-600 rounded-xl p-4 text-xs font-bold text-center">
                    Vui lòng đăng nhập để chọn giáo án cá nhân dự thi cuộc thi này.
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedComp(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Đóng lại
                </button>
                {user && myResources.length > 0 && (
                  <button 
                    onClick={handleSubmitEntry}
                    disabled={submitting || !selectedResourceId}
                    className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow"
                  >
                    {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Nộp bài thi ngay
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
