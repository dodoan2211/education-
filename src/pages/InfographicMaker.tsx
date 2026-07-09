import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, FileText, Send, Image as ImageIcon, UploadCloud, X } from "lucide-react";
import { Link } from "react-router";
import InfographicRenderer from "../components/InfographicRenderer";
import Layout from "../components/Layout";
import PlanAccessGuard from "../components/PlanAccessGuard";
import { useAuth } from "../AuthContext";
import { useToast } from "../context/ToastContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { increment } from "firebase/firestore";
import { cleanObject } from "../utils/textCleaner";

export default function InfographicMaker() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFreeUser = userProfile?.package !== 'pro' && userProfile?.package !== 'enterprise' && user?.email !== "dodoan2211@gmail.com";

  // Block copy for free users when result is present
  useEffect(() => {
    if (isFreeUser && result) {
      const handleCopy = (e: ClipboardEvent) => {
        e.preventDefault();
        toast.warning("Tài khoản chưa nâng cấp gói. Vui lòng nâng cấp gói Pro hoặc Enterprise để sao chép nội dung!");
      };
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          toast.warning("Tài khoản chưa nâng cấp gói. Vui lòng nâng cấp gói Pro hoặc Enterprise để sao chép nội dung!");
        }
      };

      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        toast.warning("Tính năng chuột phải bị khóa cho tài khoản dùng thử. Vui lòng nâng cấp gói!");
      };

      window.addEventListener("copy", handleCopy);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("contextmenu", handleContextMenu);

      return () => {
        window.removeEventListener("copy", handleCopy);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("contextmenu", handleContextMenu);
      };
    }
  }, [isFreeUser, result]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!prompt && files.length === 0) return;

    // Check trial limit for free user
    if (isFreeUser) {
      if ((userProfile?.usageCount || 0) >= 2) {
        toast.error("Bạn đã sử dụng hết 2 lượt tạo thử miễn phí. Vui lòng nâng cấp gói để tiếp tục sử dụng.");
        return;
      }
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      let finalPrompt = prompt;
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
        body: JSON.stringify({ prompt: finalPrompt, type: "infographic" })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");

      const responseText = data.text || data.result;
      if (!responseText) throw new Error("AI không trả về kết quả.");

      try {
        const cleanResult = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanResult);
        // Clean all fields recursively using cleanObject helper
        const cleanedData = cleanObject(parsedData);
        setResult(cleanedData);

        // Increment usage count for free users
        if (user && isFreeUser) {
          try {
            await setDoc(doc(db, "users", user.uid), {
              usageCount: increment(1)
            }, { merge: true });
          } catch (e) {
            console.error("Lỗi cập nhật số lượt dùng:", e);
          }
        }
      } catch (parseError) {
        setError(`Lỗi xử lý dữ liệu. AI trả về sai định dạng.\n${responseText}`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <PlanAccessGuard hasResult={!!result} isGenerating={loading} noLayout={true}>
        <div className="h-[calc(100vh-64px)] flex">
          {/* Sidebar */}
          <div className="w-1/3 border-r border-slate-200 bg-white flex flex-col shadow-[2px_0_10px_rgba(0,0,0,0.02)] z-10">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <Link to="/dashboard" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-rose-600" /> Tạo Infographic
                </h2>
                <p className="text-xs text-slate-500">Thiết kế đồ họa bài học từ tài liệu</p>
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
              {isFreeUser && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3.5 flex flex-col gap-1.5 shadow-sm">
                  <p className="font-bold flex items-center gap-1.5 text-amber-950">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                    Chế độ dùng thử EduCreate
                  </p>
                  <p>Thầy cô đang sử dụng gói Miễn phí: Đã dùng <b className="text-slate-900">{userProfile?.usageCount || 0}/2</b> lượt.</p>
                  <p className="text-[10px] text-amber-800 leading-snug">Nâng cấp tài khoản lên gói Pro hoặc Enterprise để mở khóa không giới hạn lượt tạo và sao chép (copy) nội dung.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Chủ đề / Yêu cầu tóm tắt</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ví dụ: Tóm tắt bài Hệ Mặt Trời lớp 6..."
                  className="w-full h-32 p-3 rounded-xl border border-slate-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-50 text-sm resize-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tài liệu tham khảo (Tùy chọn, TXT)</label>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 relative hover:bg-slate-100 transition-colors cursor-pointer group">
                  <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-rose-500 transition-colors mb-2" />
                  <p className="text-sm font-medium text-slate-600 group-hover:text-rose-600">Bấm để tải lên tài liệu</p>
                  <p className="text-xs text-slate-400 mt-1">Hỗ trợ file .txt</p>
                  <input 
                    type="file" 
                    multiple 
                    accept=".txt"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                
                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                        </div>
                        <button 
                          onClick={() => removeFile(idx)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-auto">
                <button 
                  onClick={handleGenerate}
                  disabled={loading || (!prompt && files.length === 0)}
                  className="w-full flex items-center justify-center gap-2 bg-rose-600 text-white p-3.5 rounded-xl font-bold shadow-md hover:bg-rose-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Đang thiết kế...</>
                  ) : (
                    <><Send className="w-5 h-5" /> Tạo Infographic</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1 bg-slate-50 flex flex-col">
            <div className="flex-1 overflow-auto p-8 relative">
              {!result && !loading && !error && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon className="w-16 h-16 mb-4 text-slate-300" />
                  <p className="text-base font-medium">Nhập chủ đề hoặc tải tài liệu lên để bắt đầu thiết kế.</p>
                </div>
              )}
              {loading && (
                <div className="h-full flex flex-col items-center justify-center text-rose-600">
                  <Loader2 className="w-10 h-10 animate-spin mb-4" />
                  <p className="font-bold text-lg">AI đang sắp xếp bố cục và thiết kế...</p>
                  <p className="text-sm text-slate-500 mt-2">Vui lòng đợi trong giây lát</p>
                </div>
              )}
              {error && (
                <div className="h-full flex flex-col items-center justify-center text-red-500">
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 max-w-xl text-center">
                    <p className="font-bold mb-2">Đã xảy ra lỗi</p>
                    <p className="text-sm whitespace-pre-wrap">{error}</p>
                  </div>
                </div>
              )}
              {result && (
                <div className={`w-full flex justify-center py-4 ${isFreeUser ? "select-none pointer-events-none" : ""}`}>
                  <InfographicRenderer data={result} />
                </div>
              )}
            </div>
          </div>
        </div>
      </PlanAccessGuard>
    </Layout>
  );
}
