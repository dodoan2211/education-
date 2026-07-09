import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import { useToast } from "../context/ToastContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ShieldCheck, UserCircle, Phone, MapPin, Mail, Loader2, CheckCircle2, ShieldAlert, Camera, Lock, KeyRound, Eye, EyeOff } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    workplace: "",
    verified: false,
    avatar: "",
    hideEmail: false,
    hidePhone: false,
  });

  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfileData({
            name: data.name || "",
            email: data.email || user.email || "",
            phone: data.phone || "",
            workplace: data.workplace || "",
            verified: data.verified || false,
            avatar: data.avatar || "",
            hideEmail: data.hideEmail || false,
            hidePhone: data.hidePhone || false,
          });
          setGeminiApiKey(data.geminiApiKey || "");
          if (data.name && data.phone && data.workplace) {
            setIsLocked(true);
          }
        } else {
          setProfileData((prev) => ({
            ...prev,
            name: user.displayName || "",
            email: user.email || "",
          }));
        }
      } catch (error) {
        console.error("Lỗi khi tải hồ sơ:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast.error("Dung lượng ảnh đại diện quá lớn (tối đa 500KB).");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setProfileData(prev => ({ ...prev, avatar: base64String }));

      if (user) {
        setSaving(true);
        try {
          await setDoc(doc(db, "users", user.uid), { avatar: base64String }, { merge: true });
          toast.success("Đã cập nhật ảnh đại diện thành công!");
        } catch (error) {
          toast.error("Có lỗi xảy ra khi lưu ảnh đại diện.");
        } finally {
          setSaving(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");

    try {
      await setDoc(doc(db, "users", user.uid), {
        name: profileData.name,
        phone: profileData.phone,
        workplace: profileData.workplace,
      }, { merge: true });
      setMessage("Đã cập nhật hồ sơ thành công!");
      toast.success("Đã cập nhật hồ sơ thành công!");
      if (profileData.name && profileData.phone && profileData.workplace) {
        setIsLocked(true);
      }
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Có lỗi xảy ra khi cập nhật hồ sơ. Vui lòng thử lại.");
      toast.error("Có lỗi xảy ra khi cập nhật hồ sơ.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!user) return;
    setSavingKey(true);
    try {
      await setDoc(doc(db, "users", user.uid), { geminiApiKey: geminiApiKey.trim() }, { merge: true });
      toast.success("Đã lưu Gemini API Key thành công!");
    } catch (error) {
      toast.error("Không thể lưu API Key. Vui lòng thử lại.");
    } finally {
      setSavingKey(false);
    }
  };

  const handleTogglePrivacy = async (field: 'hideEmail' | 'hidePhone') => {
    if (!user) return;
    const newValue = !profileData[field];
    setProfileData(prev => ({ ...prev, [field]: newValue }));

    try {
      await setDoc(doc(db, "users", user.uid), { [field]: newValue }, { merge: true });
      toast.success("Đã cập nhật cài đặt riêng tư thành công!");
    } catch (error) {
      setProfileData(prev => ({ ...prev, [field]: !newValue }));
      toast.error("Không thể lưu cài đặt riêng tư.");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
            <UserCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cài đặt</h1>
            <p className="text-sm text-slate-500 mt-1">Quản lý thông tin tài khoản và API key AI</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
              <div className="relative w-24 h-24 mx-auto mb-4 group">
                {profileData.avatar ? (
                  <img
                    src={profileData.avatar}
                    alt="Avatar"
                    className="w-24 h-24 rounded-full object-cover border border-slate-200 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 text-slate-400 font-bold text-3xl">
                    {profileData.name?.[0] || profileData.email?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full cursor-pointer shadow-md transition-all border-2 border-white flex items-center justify-center hover:scale-105 active:scale-95">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">{profileData.name || "Giáo viên"}</h2>
              <p className="text-sm text-slate-500">{profileData.workplace || "Chưa cập nhật nơi công tác"}</p>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  profileData.verified
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {profileData.verified ? 'Tài khoản đã xác thực' : 'Chưa xác thực'}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" /> Về Gemini API Key
              </h3>
              <ul className="text-xs text-blue-800 space-y-2 list-disc list-inside">
                <li>Lấy miễn phí tại Google AI Studio</li>
                <li>Key cá nhân — không bị giới hạn lượt dùng</li>
                <li>Được mã hóa và lưu trữ an toàn</li>
                <li>Dùng cho tất cả tính năng AI trên web</li>
              </ul>
            </div>
          </div>

          {/* Right Column */}
          <div className="col-span-1 md:col-span-2 space-y-6">
            {/* Gemini API Key Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-blue-600" /> Gemini API Key
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Nhập API key cá nhân để sử dụng AI. Lấy miễn phí tại{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Google AI Studio
                  </a>
                  .
                </p>
              </div>

              <div className="p-6">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="AIza..."
                      className="block w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={handleSaveApiKey}
                    disabled={savingKey}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Lưu Key
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Key được lưu trong tài khoản và sử dụng tự động cho mọi tính năng AI.
                </p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-900">Thông tin liên hệ</h2>
                <p className="text-sm text-slate-500 mt-1">Cập nhật thông tin để hệ thống hỗ trợ tốt hơn.</p>
              </div>

              <div className="p-6">
                {isLocked && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm rounded-xl flex items-start gap-2.5 shadow-sm">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-950">Thông tin hồ sơ đã bị khóa</p>
                      <p className="text-amber-800/95 mt-0.5 leading-relaxed">Hồ sơ đã được cập nhật đầy đủ và khóa tự động. Vui lòng liên hệ ban quản trị nếu cần sửa đổi.</p>
                    </div>
                  </div>
                )}

                {message && (
                  <div className={`mb-6 p-4 rounded-lg text-sm font-medium flex items-center gap-2 ${message.includes('lỗi') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    {message.includes('lỗi') ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {message}
                  </div>
                )}

                <form onSubmit={handleSave} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                        <UserCircle className="w-4 h-4 text-slate-400" /> Họ và Tên
                      </label>
                      <input
                        type="text"
                        required
                        disabled={isLocked || saving}
                        value={profileData.name}
                        onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                        className={`block w-full px-4 py-2 border rounded-lg sm:text-sm transition-colors ${
                          isLocked
                            ? "border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                            : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" /> Email
                      </label>
                      <input
                        type="email"
                        disabled
                        value={profileData.email}
                        className="block w-full px-4 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg sm:text-sm cursor-not-allowed"
                      />
                      <p className="text-xs text-slate-400 mt-1">Email không thể thay đổi.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" /> Số điện thoại
                      </label>
                      <input
                        type="tel"
                        required
                        disabled={isLocked || saving}
                        value={profileData.phone}
                        onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                        className={`block w-full px-4 py-2 border rounded-lg sm:text-sm transition-colors ${
                          isLocked
                            ? "border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                            : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" /> Nơi công tác
                      </label>
                      <input
                        type="text"
                        required
                        disabled={isLocked || saving}
                        value={profileData.workplace}
                        onChange={(e) => setProfileData({...profileData, workplace: e.target.value})}
                        className={`block w-full px-4 py-2 border rounded-lg sm:text-sm transition-colors ${
                          isLocked
                            ? "border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                            : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="submit"
                      disabled={isLocked || saving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isLocked ? "Hồ sơ đã được khóa" : "Lưu thay đổi"}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" /> Cài đặt riêng tư
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Kiểm soát thông tin nào được hiển thị công khai với đồng nghiệp.
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="space-y-0.5 pr-4">
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer" onClick={() => handleTogglePrivacy('hideEmail')}>
                      <Mail className="w-4 h-4 text-slate-400" /> Ẩn Email liên hệ
                    </label>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Khi bật, Email sẽ hiển thị là "Đã ẩn để bảo mật" với đồng nghiệp.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePrivacy('hideEmail')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      profileData.hideEmail ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        profileData.hideEmail ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="space-y-0.5 pr-4">
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer" onClick={() => handleTogglePrivacy('hidePhone')}>
                      <Phone className="w-4 h-4 text-slate-400" /> Ẩn Số điện thoại
                    </label>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Khi bật, số điện thoại sẽ hiển thị là "Đã ẩn để bảo mật" với đồng nghiệp.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePrivacy('hidePhone')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      profileData.hidePhone ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        profileData.hidePhone ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
