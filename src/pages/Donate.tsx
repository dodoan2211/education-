import Layout from "../components/Layout";
import { Heart, QrCode, ExternalLink } from "lucide-react";

const QR_URL = `https://img.vietqr.io/image/MB-9666989889-compact2.png?addInfo=${encodeURIComponent("DONATE EDUCREATE")}&accountName=${encodeURIComponent("DO VAN DOAN")}`;

export default function Donate() {
  return (
    <Layout>
      <div className="max-w-lg mx-auto py-8 space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-600 rounded-lg flex items-center justify-center text-white">
            <Heart className="w-5 h-5 fill-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ủng hộ EduCreate</h1>
            <p className="text-sm text-slate-500 mt-0.5">Giúp chúng tôi duy trì và phát triển dịch vụ</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-rose-600" />
            <span className="text-sm font-semibold text-rose-700">Quét mã QR để chuyển khoản</span>
          </div>

          <div className="p-8 flex flex-col items-center gap-6">
            <img
              src={QR_URL}
              alt="Mã QR donate EduCreate"
              className="w-56 h-56 object-contain rounded-2xl border border-slate-200 shadow-md"
            />

            <div className="w-full bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200 text-sm">
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-slate-500 font-medium">Ngân hàng</span>
                <span className="font-bold text-slate-900">MB BANK</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-slate-500 font-medium">Số tài khoản</span>
                <span className="font-bold text-slate-900 font-mono">9666989889</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-slate-500 font-medium">Chủ tài khoản</span>
                <span className="font-bold text-slate-900">DO VAN DOAN</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-slate-500 font-medium">Nội dung CK</span>
                <span className="font-bold text-rose-600">DONATE EDUCREATE</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3">
                <span className="text-slate-500 font-medium">Số tiền</span>
                <span className="font-bold text-slate-900">Tùy tâm</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Mọi đóng góp dù nhỏ đều giúp EduCreate tiếp tục phục vụ cộng đồng giáo viên Việt Nam.
              Cảm ơn thầy cô rất nhiều!
            </p>
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-100 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-rose-800">Sự ủng hộ của thầy cô giúp chúng tôi:</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {[
              "Duy trì server và hạ tầng hoạt động 24/7",
              "Phát triển thêm tính năng AI mới cho giáo viên",
              "Giữ dịch vụ miễn phí hoàn toàn cho cộng đồng",
              "Cải thiện chất lượng và tốc độ xử lý AI",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Layout>
  );
}
