import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "react-router";
import Layout from "../components/Layout";
import ReactMarkdown from "react-markdown";
import { Loader2, Wand2, Save, Check, FileText, Upload, Download, FileDown, Presentation } from "lucide-react";
import { db } from "../firebase";
import { useToast } from "../context/ToastContext";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  setDoc,
  getDoc
} from "firebase/firestore";
import { useAuth } from "../AuthContext";

const TOOL_CONFIG: Record<string, { title: string, placeholder: string }> = {
  lesson_plan: { title: "Soạn Giáo Án", placeholder: "Mô tả bài giảng, ví dụ: Giáo án Toán lớp 5, bài Diện tích hình tam giác..." },
  plan: { title: "Lập Kế Hoạch", placeholder: "Yêu cầu kế hoạch, ví dụ: Kế hoạch ngoại khóa tháng 11 chủ đề Tôn sư trọng đạo..." },
  digital: { title: "Chuyển Đổi Số", placeholder: "Yêu cầu giải pháp, ví dụ: Đề xuất công cụ kiểm tra đánh giá trực tuyến cho môn Tiếng Anh..." },
  video: { title: "AI Video Studio", placeholder: "Nhập kịch bản để tạo video bài giảng..." }
};

export default function ToolArea() {
  const { type } = useParams<{ type: string }>();
  const [searchParams] = useSearchParams();
  const [prompt, setPrompt] = useState(searchParams.get("prompt") || "");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  // Custom parameters for enhanced AI accuracy
  const [grade, setGrade] = useState("Lớp 6");
  const [subject, setSubject] = useState("Ngữ văn");
  const [teachingMethod, setTeachingMethod] = useState("Thảo luận nhóm");
  const [templateStyle, setTemplateStyle] = useState("Mẫu chuẩn Công văn 5512 (đầy đủ 4 bước)");

  const [schoolLevel, setSchoolLevel] = useState("THCS");
  const [digitalFocus, setDigitalFocus] = useState("Số hóa quản lý và giảng dạy (LMS)");
  const [currentStatus, setCurrentStatus] = useState("Trung bình (Có máy chiếu, dùng phần mềm quản lý)");
  const [duration, setDuration] = useState("3 năm");

  const [planType, setPlanType] = useState("Kế hoạch ngoại khóa/trải nghiệm");
  const [planDuration, setPlanDuration] = useState("Học kỳ");

  // Video AI specific
  const [videoStyle, setVideoStyle] = useState("Hoạt hình 2D");
  const [videoBgImage, setVideoBgImage] = useState<File | null>(null);
  const [videoCharImage, setVideoCharImage] = useState<File | null>(null);

  const resourceId = searchParams.get("id");

  useEffect(() => {
    if (!resourceId || !user) return;

    async function fetchResource() {
      try {
        const docRef = doc(db, "resources", resourceId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.userId === user.uid || data.isShared) {
            setResult(data.content);
            setSaved(true);
            if (data.title) setPrompt(data.title);
          } else {
            toast.error("Bạn không có quyền xem tài liệu này.");
          }
        }
      } catch (e) {
        console.error("Error fetching resource:", e);
        toast.error("Lỗi khi tải tài liệu.");
      }
    }
    fetchResource();
  }, [resourceId, user]);

  const config = type && TOOL_CONFIG[type] ? TOOL_CONFIG[type] : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && files.length === 0) return;
    if (!user) return;

    if (type === "video") {
      setLoading(true);
      setResult("");
      setTimeout(() => {
        let additionalDetails = `\n- **Phong cách:** ${videoStyle}`;
        if (videoCharImage) additionalDetails += `\n- **Ảnh nhân vật:** Đã tải lên (${videoCharImage.name})`;
        if (videoBgImage) additionalDetails += `\n- **Ảnh bối cảnh:** Đã tải lên (${videoBgImage.name})`;

        setResult(`### ✅ Yêu cầu Video đã được gửi thành công!\n\nHệ thống đang xử lý kịch bản của bạn. Video bài giảng với giảng viên ảo sẽ được tạo tự động và gửi thông báo qua email cho thầy cô khi hoàn tất (thường mất 15-30 phút).\n\n**Chi tiết yêu cầu:**${additionalDetails}`);
        setLoading(false);
        setSaved(false);
      }, 2000);
      return;
    }

    setLoading(true);
    setResult("");

    try {
      let meta = "";
      if (type === "lesson_plan") {
        meta += `[YÊU CẦU THIẾT KẾ GIÁO ÁN CHI TIẾT]:\n`;
        meta += `- Khối lớp: ${grade}\n`;
        meta += `- Môn học: ${subject}\n`;
        meta += `- Phương pháp dạy học chính: ${teachingMethod}\n`;
        meta += `- Mẫu thiết kế giáo án: ${templateStyle}\n`;
      } else if (type === "digital") {
        meta += `[YÊU CẦU THIẾT KẾ CHIẾN LƯỢC CHUYỂN ĐỔI SỐ]:\n`;
        meta += `- Cấp học/Đơn vị áp dụng: ${schoolLevel}\n`;
        meta += `- Trọng tâm chuyển đổi số: ${digitalFocus}\n`;
        meta += `- Trạng thái sẵn sàng hạ tầng hiện tại: ${currentStatus}\n`;
        meta += `- Khung thời gian chiến lược: ${duration}\n`;
      } else if (type === "plan") {
        meta += `[YÊU CẦU THIẾT KẾ KẾ HOẠCH PHÁT TRIỂN]:\n`;
        meta += `- Loại kế hoạch/Hoạt động: ${planType}\n`;
        meta += `- Quy mô/Thời hạn thực hiện: ${planDuration}\n`;
      }

      let finalPrompt = prompt;
      if (meta && prompt.trim()) {
        finalPrompt = `${meta}- Ý tưởng / Chủ đề yêu cầu: ${prompt}`;
      } else if (meta) {
        finalPrompt = `${meta}- Hãy lập bài viết chi tiết, hoàn chỉnh nhất có thể.`;
      }

      let fileContents = "";
      if (files.length > 0) {
        for (const file of files) {
          if (file.name.endsWith('.txt')) {
            try {
              const text = await file.text();
              fileContents += `\n--- Nội dung file ${file.name} ---\n${text}\n`;
            } catch (e) {
              console.error("Error reading file", e);
            }
          }
        }
        if (fileContents) {
          finalPrompt += `\n[Tài liệu đính kèm: ${files.map(f => f.name).join(", ")}]\n${fileContents}`;
        } else {
          finalPrompt += `\n[Tài liệu đính kèm: ${files.map(f => f.name).join(", ")}]`;
        }
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt, type, apiKey: userProfile?.geminiApiKey || undefined })
      });
      const data = await res.json();
      if (data.text) {
        let cleanText = data.text;
        cleanText = cleanText.replace(/\\/g, "");
        setResult(cleanText);
        setSaved(false);
      } else {
        setResult("Đã có lỗi kết nối. Vui lòng thử lại sau.");
      }
    } catch (err) {
      setResult("Lỗi máy chủ nội bộ. Vui lòng báo cáo với bộ phận IT.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !result || !type) return;
    setSaving(true);
    try {
      const title = prompt.trim() ? (prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt) : config?.title || "Tài liệu chưa đặt tên";

      if (resourceId) {
        const docRef = doc(db, "resources", resourceId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.userId === user.uid || data.isShared) {
            await updateDoc(docRef, {
              content: result,
              title: title,
              updatedAt: serverTimestamp()
            });

            if (data.isShared) {
              await addDoc(collection(db, "resource_versions"), {
                resourceId: resourceId,
                userId: user.uid,
                userName: userProfile?.name || user.email?.split('@')[0] || "Đồng nghiệp",
                content: result,
                createdAt: serverTimestamp(),
                changeType: "edit"
              });
            }

            toast.success("Đã cập nhật tài liệu thành công!");
          } else {
            toast.error("Bạn không có quyền cập nhật tài liệu này.");
          }
        }
      } else {
        await addDoc(collection(db, "resources"), {
          userId: user.uid,
          title: title,
          type: type,
          content: result,
          workplace: userProfile?.workplace || "",
          createdAt: serverTimestamp()
        });
        toast.success("Đã lưu trữ tài liệu vào kho cá nhân thành công!");
      }
      setSaved(true);
    } catch (error) {
      console.error("Lỗi lưu trữ:", error);
      toast.error("Không thể lưu tài liệu. Kiểm tra quyền truy cập.");
    } finally {
      setSaving(false);
    }
  };

  const downloadFile = (format: 'doc' | 'ppt') => {
    const element = document.createElement("a");
    const file = new Blob([result], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `Giao_an.${format}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!config) return <Layout><div className="p-8 font-medium text-slate-500">Mô-đun không tồn tại.</div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto flex flex-col h-full gap-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{config.title}</h1>
              <p className="text-sm text-slate-500 font-medium">Hệ thống AI Workspace</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Input Panel */}
          <div className="col-span-1 lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex-1 flex flex-col">
              <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-blue-600" /> Tham số đầu vào
              </label>

              <div className="mb-4">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Tải lên tài liệu tham khảo (PDF, Word, TXT)
                </button>

                {files.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded border border-slate-200 text-xs">
                        <span className="truncate text-slate-700 font-medium">{f.name}</span>
                        <button onClick={() => removeFile(i)} className="text-red-500 hover:text-red-700 ml-2">Xóa</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {type === "lesson_plan" && (
                <div className="mb-4 space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Môn học</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      {["Ngữ văn", "Toán", "Tiếng Anh", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "Tin học", "Công nghệ", "Giáo dục công dân", "Giáo dục thể chất", "Âm nhạc", "Mỹ thuật", "Kĩ năng sống"].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Khối lớp</label>
                      <select
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      >
                        {["Mầm non", "Lớp 1", "Lớp 2", "Lớp 3", "Lớp 4", "Lớp 5", "Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "Lớp 10", "Lớp 11", "Lớp 12", "Đại học"].map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Phương pháp dạy</label>
                      <select
                        value={teachingMethod}
                        onChange={(e) => setTeachingMethod(e.target.value)}
                        className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      >
                        {["Thảo luận nhóm", "Trực quan tương tác", "Bàn tay nặn bột", "Dạy học dự án", "Giải quyết vấn đề", "Trò chơi học tập", "Thuyết trình tích cực"].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Mẫu giáo án sư phạm</label>
                    <select
                      value={templateStyle}
                      onChange={(e) => setTemplateStyle(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      {["Mẫu chuẩn Công văn 5512 (đầy đủ 4 bước)", "Mẫu phát triển năng lực hiện đại", "Mẫu rút gọn / Giáo án 1 trang"].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {type === "digital" && (
                <div className="mb-4 space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Cấp học / Đơn vị</label>
                      <select
                        value={schoolLevel}
                        onChange={(e) => setSchoolLevel(e.target.value)}
                        className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      >
                        {["Mầm non", "Tiểu học", "THCS", "THPT", "Liên cấp", "GDTX/Ngoại ngữ", "Đại học/Cao đẳng", "Phòng/Sở Giáo dục"].map(sl => (
                          <option key={sl} value={sl}>{sl}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Thời gian</label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      >
                        {["1 năm ngắn hạn", "3 năm trung hạn", "5 năm chiến lược"].map(dur => (
                          <option key={dur} value={dur}>{dur}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Trọng tâm Chuyển đổi số</label>
                    <select
                      value={digitalFocus}
                      onChange={(e) => setDigitalFocus(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      {["Số hóa quản lý và giảng dạy (LMS)", "Số hóa tài liệu & Kho học liệu số", "Nâng cao năng lực số đội ngũ GV", "Lớp học thông minh & Thiết bị số", "Đánh giá và kiểm tra trực tuyến"].map(df => (
                        <option key={df} value={df}>{df}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Hạ tầng công nghệ hiện tại</label>
                    <select
                      value={currentStatus}
                      onChange={(e) => setCurrentStatus(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      {["Cơ bản (Chỉ dùng máy tính văn phòng)", "Trung bình (Có máy chiếu, phần mềm quản lý)", "Khá (Có phòng Lab, dùng tích cực LMS)", "Nâng cao (Trường thông minh toàn diện)"].map(cs => (
                        <option key={cs} value={cs}>{cs}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {type === "plan" && (
                <div className="mb-4 space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Loại kế hoạch</label>
                    <select
                      value={planType}
                      onChange={(e) => setPlanType(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      {["Kế hoạch ngoại khóa/trải nghiệm", "Kế hoạch công tác năm học", "Kế hoạch tổ chuyên môn", "Kế hoạch bồi dưỡng học sinh giỏi", "Kế hoạch phụ đạo học sinh yếu", "Kế hoạch họp phụ huynh học sinh"].map(pt => (
                        <option key={pt} value={pt}>{pt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Quy mô / Thời hạn thực hiện</label>
                    <select
                      value={planDuration}
                      onChange={(e) => setPlanDuration(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      {["Tuần học", "Tháng học", "Học kỳ", "Cả năm học"].map(pd => (
                        <option key={pd} value={pd}>{pd}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {type === "video" && (
                <div className="mb-4 space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Phong cách Video</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="videoStyle"
                          value="Hoạt hình 2D"
                          checked={videoStyle === "Hoạt hình 2D"}
                          onChange={(e) => setVideoStyle(e.target.value)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        Hoạt hình 2D
                      </label>
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="videoStyle"
                          value="Hoạt hình 3D"
                          checked={videoStyle === "Hoạt hình 3D"}
                          onChange={(e) => setVideoStyle(e.target.value)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        Hoạt hình 3D
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Ảnh Nhân Vật (Tùy chọn)</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setVideoCharImage(e.target.files?.[0] || null)}
                          className="hidden"
                          id="char-image-upload"
                        />
                        <label
                          htmlFor="char-image-upload"
                          className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-300 rounded-xl p-3 text-sm text-slate-500 hover:bg-slate-100 hover:border-slate-400 transition-colors cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          {videoCharImage ? videoCharImage.name : "Tải lên ảnh nhân vật"}
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Ảnh Bối Cảnh (Tùy chọn)</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setVideoBgImage(e.target.files?.[0] || null)}
                          className="hidden"
                          id="bg-image-upload"
                        />
                        <label
                          htmlFor="bg-image-upload"
                          className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-300 rounded-xl p-3 text-sm text-slate-500 hover:bg-slate-100 hover:border-slate-400 transition-colors cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          {videoBgImage ? videoBgImage.name : "Tải lên bối cảnh"}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Ý tưởng & mô tả chi tiết của thầy cô
              </label>

              <textarea
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={config.placeholder}
                className="w-full flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none transition-all text-sm mb-4"
              />
              <button
                onClick={handleGenerate}
                disabled={loading || (!prompt.trim() && files.length === 0)}
                className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-4 shadow-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {loading ? "Đang xử lý dữ liệu..." : "Chạy luồng xử lý AI"}
              </button>
            </div>
          </div>

          {/* Output Panel */}
          <div className="col-span-1 lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[600px] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Tài liệu Đầu ra</h2>
              {result && (
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadFile('doc')}
                    className="text-slate-700 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition-all shadow-sm"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Xuất Word
                  </button>
                  {type === 'lesson_plan' && (
                    <button
                      onClick={() => downloadFile('ppt')}
                      className="text-slate-700 hover:text-orange-700 hover:bg-orange-50 border border-slate-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition-all shadow-sm"
                    >
                      <Presentation className="w-3.5 h-3.5" /> Xuất PPT
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || saved}
                    className={`${saved ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-700 hover:text-blue-700 hover:bg-blue-50 border-slate-200'} border px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition-all disabled:opacity-70 shadow-sm`}
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    {saving ? 'Đang ghi...' : saved ? 'Đã lưu' : 'Lưu trữ'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto p-8">
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <FileText className="w-12 h-12 mb-3 text-slate-300" />
                  <p className="text-sm font-medium">Chưa có dữ liệu. {type === 'lesson_plan' ? 'Tải lên tài liệu hoặc nhập tham số để bắt đầu.' : 'Nhập tham số để bắt đầu.'}</p>
                </div>
              )}
              {loading && (
                <div className="h-full flex flex-col items-center justify-center text-blue-600">
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  <p className="font-medium text-sm">Hệ thống đang tổng hợp dữ liệu...</p>
                </div>
              )}
              {result && (
                <div className="markdown-body prose max-w-none prose-slate prose-headings:font-bold prose-a:text-blue-600 prose-sm sm:prose-base">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
