import React from 'react';
import { FlaskConical, Cpu, BrainCircuit, CheckCircle2, ArrowRight, Play, BookOpen, Layers, Lightbulb, Users, Shield, Check } from 'lucide-react';
import { Link } from 'react-router';

export function STEMPortal() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <div className="bg-rose-600 rounded-3xl p-8 md:p-12 text-white mb-12 relative overflow-hidden shadow-2xl shadow-rose-100">
        <div className="relative z-10 max-w-2xl">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
            <FlaskConical className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight tracking-tight">Kỷ nguyên Giáo dục STEM</h1>
          <p className="text-xl text-rose-50 opacity-90 mb-8 leading-relaxed">
            Kết nối Khoa học, Công nghệ, Kỹ thuật và Toán học thông qua các dự án thực tiễn. 
            Khơi dậy niềm đam mê khám phá và tư duy sáng tạo cho thế hệ trẻ.
          </p>
          <div className="flex flex-wrap gap-4">
            <button className="px-8 py-3 bg-white text-rose-600 rounded-xl font-bold hover:bg-rose-50 transition-all flex items-center gap-2 relative group/btn">
              Khám phá khóa học <ArrowRight className="w-5 h-5" />
              <span className="absolute -top-3 -right-3 bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 rounded-full border border-rose-200 font-black uppercase tracking-wider">Đang phát triển</span>
            </button>
            <button className="px-8 py-3 bg-rose-700 text-white rounded-xl font-bold hover:bg-rose-800 transition-all border border-rose-500 relative group/btn">
              Xem dự án mẫu
              <span className="absolute -top-3 -right-3 bg-rose-800 text-rose-100 text-[10px] px-2 py-0.5 rounded-full border border-rose-600 font-black uppercase tracking-wider">Đang phát triển</span>
            </button>
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/10 skew-x-12 translate-x-1/2 -z-0 hidden lg:block"></div>
        <FlaskConical className="absolute right-12 bottom-12 w-64 h-64 text-white/5 -rotate-12 hidden lg:block" />
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-4">Lộ trình học tập</h3>
          <p className="text-slate-600 leading-relaxed mb-6">Chương trình được thiết kế bài bản từ cơ bản đến nâng cao, phù hợp với mọi lứa tuổi từ Tiểu học đến THPT.</p>
          <ul className="space-y-3">
            {['STEM Robotics', 'Khoa học vui', 'Kỹ sư nhí'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {item}
              </li>
            ))}
          </ul>
        </div>
        
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-6">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-4">Dự án liên môn</h3>
          <p className="text-slate-600 leading-relaxed mb-6">Ứng dụng kiến thức đa lĩnh vực để giải quyết các vấn đề thực tế trong đời sống và môi trường.</p>
          <ul className="space-y-3">
            {['Máy lọc nước mini', 'Năng lượng sạch', 'Nông nghiệp thông minh'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-6">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-4">Cộng đồng sáng tạo</h3>
          <p className="text-slate-600 leading-relaxed mb-6">Nơi giáo viên và học sinh chia sẻ ý tưởng, sản phẩm và cùng nhau phát triển các dự án mới.</p>
          <ul className="space-y-3">
            {['Chia sẻ sản phẩm', 'Thi đấu Robotics', 'Câu lạc bộ STEM'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function AIPortal() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <div className="bg-indigo-600 rounded-3xl p-8 md:p-12 text-white mb-12 relative overflow-hidden shadow-2xl shadow-indigo-100">
        <div className="relative z-10 max-w-2xl">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
            <BrainCircuit className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight tracking-tight">Trí tuệ nhân tạo (AI) trong Giáo dục</h1>
          <p className="text-xl text-indigo-50 opacity-90 mb-8 leading-relaxed">
            Khám phá sức mạnh của AI để tối ưu hóa việc dạy và học. 
            Học cách làm chủ các công cụ AI hiện đại để trở thành người dẫn đầu trong kỷ nguyên số.
          </p>
          <div className="flex flex-wrap gap-4">
            <button className="px-8 py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 relative">
              Bắt đầu học ngay <ArrowRight className="w-5 h-5" />
              <span className="absolute -top-3 -right-3 bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full border border-indigo-200 font-black uppercase tracking-wider">Đang phát triển</span>
            </button>
            <button className="px-8 py-3 bg-indigo-700 text-white rounded-xl font-bold hover:bg-indigo-800 transition-all border border-indigo-500 relative">
              Công cụ AI hỗ trợ
              <span className="absolute -top-3 -right-3 bg-indigo-800 text-indigo-100 text-[10px] px-2 py-0.5 rounded-full border border-indigo-600 font-black uppercase tracking-wider">Đang phát triển</span>
            </button>
          </div>
        </div>
        <BrainCircuit className="absolute right-12 bottom-12 w-64 h-64 text-white/5 -rotate-12 hidden lg:block" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Machine Learning', desc: 'Hiểu nguyên lý hoạt động của máy học qua các ví dụ trực quan.', icon: <Layers /> },
          { title: 'AI Tạo nội dung', desc: 'Sử dụng ChatGPT, Midjourney để tạo tài liệu giảng dạy sinh động.', icon: <Lightbulb /> },
          { title: 'Tư duy thuật toán', desc: 'Phát triển tư duy logic và cách tiếp cận vấn đề theo kiểu AI.', icon: <BrainCircuit /> },
          { title: 'Đạo đức AI', desc: 'Sử dụng AI một cách có trách nhiệm và an toàn trong học đường.', icon: <Shield /> }
        ].map((feature, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-colors group">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              {React.cloneElement(feature.icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
            </div>
            <h4 className="font-bold text-slate-900 mb-2">{feature.title}</h4>
            <p className="text-xs text-slate-500 leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArduinoPortal() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <div className="bg-amber-500 rounded-3xl p-8 md:p-12 text-white mb-12 relative overflow-hidden shadow-2xl shadow-amber-100">
        <div className="relative z-10 max-w-2xl">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
            <Cpu className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight tracking-tight">Thế giới Arduino & Robotics</h1>
          <p className="text-xl text-amber-50 opacity-90 mb-8 leading-relaxed">
            Từ những dòng lệnh đầu tiên đến những robot thông minh. 
            Làm chủ phần cứng, lập trình điều khiển và hiện thực hóa mọi ý tưởng sáng tạo.
          </p>
          <div className="flex flex-wrap gap-4">
            <button className="px-8 py-3 bg-white text-amber-600 rounded-xl font-bold hover:bg-amber-50 transition-all flex items-center gap-2 relative">
              Danh sách linh kiện <ArrowRight className="w-5 h-5" />
              <span className="absolute -top-3 -right-3 bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full border border-amber-200 font-black uppercase tracking-wider">Đang phát triển</span>
            </button>
            <button className="px-8 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all border border-amber-400 relative">
              Kho kịch bản Arduino
              <span className="absolute -top-3 -right-2 bg-amber-700 text-amber-100 text-[10px] px-2 py-0.5 rounded-full border border-amber-500 font-black uppercase tracking-wider">Đang phát triển</span>
            </button>
          </div>
        </div>
        <Cpu className="absolute right-12 bottom-12 w-64 h-64 text-white/5 -rotate-12 hidden lg:block" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="p-8 md:p-12 border-b md:border-b-0 md:border-r border-slate-200">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Dành cho Giáo viên</h3>
            <div className="space-y-6">
              {[
                'Giáo trình Arduino từ lớp 6 đến lớp 12',
                'Bộ Kit thực hành tiêu chuẩn cho lớp học',
                'Hệ thống quản lý bài tập lập trình',
                'Tài liệu hướng dẫn lắp ráp 3D'
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="text-slate-600 font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-8 md:p-12 bg-slate-50/50">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Dự án Robotics tiêu biểu</h3>
            <div className="grid grid-cols-1 gap-4">
              {[
                { name: 'Robot tránh vật cản', level: 'Cơ bản' },
                { name: 'Thùng rác thông minh', level: 'Trung cấp' },
                { name: 'Cánh tay Robot 4 bậc', level: 'Nâng cao' }
              ].map((project, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between group cursor-pointer hover:border-amber-400 transition-colors relative">
                  <span className="absolute top-0 right-0 bg-amber-50 text-amber-600 text-[8px] px-1.5 py-0.5 rounded-bl-lg font-bold uppercase">Sắp có</span>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                      <Play className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-sm">{project.name}</h5>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{project.level}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
