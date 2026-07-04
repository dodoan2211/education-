import { useState } from "react";
import { useNavigate } from "react-router";
import Layout from "../components/Layout";
import { BookOpen, Sparkles, Code, Globe, Calculator, ArrowRight, Library, Search, Filter } from "lucide-react";

interface Template {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: string;
  icon: React.ReactNode;
  color: string;
}

const TEMPLATES: Template[] = [
  {
    id: "math-1",
    title: "Giáo án Toán: Khám phá Phân số",
    description: "Bài giảng sinh động về phân số với các ví dụ thực tế và trò chơi tương tác cho học sinh Tiểu học.",
    prompt: "Soạn giáo án chi tiết môn Toán lớp 4, bài Phân số. Yêu cầu: Có hoạt động khởi động vui nhộn, chia nhóm thực hành với đồ vật thực tế, và phần củng cố kiến thức bằng trò chơi.",
    category: "Toán học",
    icon: <Calculator className="w-6 h-6 text-blue-600" />,
    color: "bg-blue-50 border-blue-100 hover:border-blue-300"
  },
  {
    id: "math-2",
    title: "Toán THCS: Phương trình bậc nhất",
    description: "Giáo án áp dụng phương pháp Bàn tay nặn bột giúp học sinh tự tìm ra cách giải phương trình.",
    prompt: "Soạn giáo án môn Toán lớp 8, bài Phương trình bậc nhất một ẩn. Sử dụng phương pháp Bàn tay nặn bột (inquiry-based learning) để học sinh tự khám phá quy tắc chuyển vế.",
    category: "Toán học",
    icon: <Calculator className="w-6 h-6 text-blue-600" />,
    color: "bg-blue-50 border-blue-100 hover:border-blue-300"
  },
  {
    id: "lit-1",
    title: "Ngữ văn: Phân tích nhân vật",
    description: "Hướng dẫn học sinh phân tích tâm lý nhân vật qua các trích đoạn văn học kinh điển.",
    prompt: "Soạn giáo án Ngữ văn lớp 9, bài Phân tích nhân vật Vũ Nương (Chuyện người con gái Nam Xương). Yêu cầu tập trung vào nghệ thuật miêu tả tâm lý và tổ chức thảo luận nhóm về giá trị nhân đạo.",
    category: "Ngữ văn",
    icon: <BookOpen className="w-6 h-6 text-rose-600" />,
    color: "bg-rose-50 border-rose-100 hover:border-rose-300"
  },
  {
    id: "lit-2",
    title: "Kỹ năng: Viết đoạn văn nghị luận",
    description: "Các bước hướng dẫn học sinh lập dàn ý và viết đoạn văn nghị luận xã hội 200 chữ.",
    prompt: "Soạn giáo án Ngữ văn lớp 12: Rèn kỹ năng viết đoạn văn nghị luận xã hội (200 chữ). Cung cấp cấu trúc chuẩn, ví dụ minh họa và bài tập thực hành bấm giờ tại lớp.",
    category: "Ngữ văn",
    icon: <BookOpen className="w-6 h-6 text-rose-600" />,
    color: "bg-rose-50 border-rose-100 hover:border-rose-300"
  },
  {
    id: "eng-1",
    title: "Tiếng Anh: Giao tiếp chủ đề Du lịch",
    description: "Bài giảng từ vựng và mẫu câu giao tiếp tình huống tại sân bay, khách sạn.",
    prompt: "Create a detailed lesson plan for a 45-minute ESL class (Pre-Intermediate level) on the topic of Travel and Holidays. Include a warm-up activity, vocabulary presentation, listening practice, and a role-play speaking task.",
    category: "Ngoại ngữ",
    icon: <Globe className="w-6 h-6 text-emerald-600" />,
    color: "bg-emerald-50 border-emerald-100 hover:border-emerald-300"
  },
  {
    id: "sci-1",
    title: "Khoa học: Chu trình Nước",
    description: "Giáo án STEM tích hợp thí nghiệm đơn giản về sự bay hơi và ngưng tụ.",
    prompt: "Soạn giáo án STEM môn Khoa học tự nhiên lớp 6, chủ đề Vòng tuần hoàn của nước. Yêu cầu thiết kế một thí nghiệm đơn giản có thể thực hiện tại lớp và phiếu học tập đi kèm.",
    category: "Khoa học",
    icon: <Sparkles className="w-6 h-6 text-amber-600" />,
    color: "bg-amber-50 border-amber-100 hover:border-amber-300"
  },
  {
    id: "stem-1",
    title: "STEM: Chế tạo xe chạy bằng phản lực",
    description: "Dự án STEM kết hợp Vật lý và Công nghệ, hướng dẫn chế tạo xe đẩy bằng bong bóng.",
    prompt: "Soạn giáo án dự án STEM: Chế tạo xe chạy bằng phản lực (dùng bong bóng và vật liệu tái chế). Phù hợp cho học sinh lớp 7. Cần có tiêu chí đánh giá sản phẩm và hướng dẫn an toàn.",
    category: "STEM",
    icon: <Code className="w-6 h-6 text-orange-600" />,
    color: "bg-orange-50 border-orange-100 hover:border-orange-300"
  },
  {
    id: "art-1",
    title: "Nghệ thuật: Lịch sử Mỹ thuật",
    description: "Khám phá các trường phái hội họa ấn tượng qua các tác phẩm nổi tiếng.",
    prompt: "Soạn bài giảng Mỹ thuật lớp 8 về trường phái Hội họa Ấn tượng. Tập trung vào Van Gogh và Monet. Thiết kế hoạt động để học sinh thử nghiệm vẽ theo phong cách này.",
    category: "Nghệ thuật",
    icon: <Sparkles className="w-6 h-6 text-pink-600" />,
    color: "bg-pink-50 border-pink-100 hover:border-pink-300"
  },
  {
    id: "plan-1",
    title: "Kế hoạch: Hoạt động ngoại khóa",
    description: "Kế hoạch tổ chức hội thao hoặc dã ngoại cho học sinh dịp lễ.",
    prompt: "Lập kế hoạch tổ chức sự kiện Ngày hội Thể thao (Sports Day) cho học sinh khối THCS. Kế hoạch cần bao gồm: Mục đích, thời gian địa điểm, các môn thi đấu, phân công nhân sự và dự trù kinh phí cơ bản.",
    category: "Kế hoạch",
    icon: <Code className="w-6 h-6 text-indigo-600" />,
    color: "bg-indigo-50 border-indigo-100 hover:border-indigo-300"
  }
];

const CATEGORIES = ["Tất cả", "Toán học", "Ngữ văn", "Ngoại ngữ", "Khoa học", "STEM", "Nghệ thuật", "Kế hoạch"];

export default function Templates() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = TEMPLATES.filter(t => {
    const matchesCategory = activeCategory === "Tất cả" || t.category === activeCategory;
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleUseTemplate = (prompt: string, type: string) => {
    const route = type === "Kế hoạch" ? "/tool/plan" : "/tool/lesson_plan";
    navigate(`${route}?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        {/* Header Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 mb-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-500/5 blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider mb-3">
                <Library className="w-3.5 h-3.5" /> EduCreate Library
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Thư Viện Mẫu Đề Xuất</h1>
              <p className="text-slate-600 leading-relaxed text-sm">
                Khám phá bộ sưu tập các mẫu yêu cầu (prompts) được thiết kế sẵn và tối ưu hóa bởi các chuyên gia giáo dục. Chọn một mẫu phù hợp để bắt đầu soạn thảo học liệu ngay lập tức.
              </p>
            </div>
            
            <div className="w-full md:w-72">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Tìm kiếm mẫu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow bg-slate-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Categories Filter */}
        <div className="flex items-center gap-3 overflow-x-auto pb-4 mb-4 scrollbar-hide">
          <div className="flex items-center gap-2 text-slate-500 px-2">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-semibold">Lọc:</span>
          </div>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat 
                  ? "bg-slate-900 text-white shadow-md" 
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredTemplates.map(template => (
              <div 
                key={template.id} 
                className={`bg-white border rounded-2xl p-6 transition-all hover:shadow-lg flex flex-col h-full group ${template.color.replace('bg-', 'hover:bg-').split(' ').filter(c => c.startsWith('hover:bg-') || c.startsWith('hover:border-')).join(' ')}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${template.color.split(' ')[0]}`}>
                    {template.icon}
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                    {template.category}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
                  {template.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6 flex-1">
                  {template.description}
                </p>
                
                <button
                  onClick={() => handleUseTemplate(template.prompt, template.category)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors mt-auto"
                >
                  Sử dụng mẫu này <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Không tìm thấy mẫu nào</h3>
            <p className="text-slate-500 text-sm">Không có mẫu nào phù hợp với từ khóa hoặc danh mục đã chọn.</p>
            <button 
              onClick={() => {setSearchQuery(""); setActiveCategory("Tất cả");}}
              className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 font-semibold rounded-lg text-sm hover:bg-blue-100 transition-colors"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
