import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import { useToast } from "../context/ToastContext";
import { doc, getDoc, updateDoc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ShieldCheck, UserCircle, Phone, MapPin, Mail, Loader2, CheckCircle2, ShieldAlert, Plus, Check, Info, Sparkles, BookOpen, Camera, Lock } from "lucide-react";
import PaymentModal from "../components/PaymentModal";

import PurchasedItems from "../components/PurchasedItems";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    workplace: "",
    verified: false,
    package: "free",
    expiresAt: null as string | null,
    avatar: "",
    hideEmail: false,
    hidePhone: false,
  });

  const [selectedPackage, setSelectedPackage] = useState<{
    key: string;
    label: string;
    price: string;
    days: number;
  } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);

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
            package: data.package || "free",
            expiresAt: data.expiresAt || null,
            avatar: data.avatar || "",
            hideEmail: data.hideEmail || false,
            hidePhone: data.hidePhone || false,
          });
          if (data.name && data.phone && data.workplace) {
            setIsLocked(true);
          }
        } else {
          // If no doc exists (fallback), use Auth user data
          setProfileData((prev) => ({
            ...prev,
            name: user.displayName || "",
            email: user.email || "",
            hideEmail: false,
            hidePhone: false,
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
      toast.error("Dung lượng ảnh đại diện quá lớn (tối đa 500KB) để tối ưu hiển thị.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setProfileData(prev => ({ ...prev, avatar: base64String }));
      
      if (user) {
        setSaving(true);
        try {
          const docRef = doc(db, "users", user.uid);
          await setDoc(docRef, {
            avatar: base64String
          }, { merge: true });
          setMessage("Đã cập nhật ảnh đại diện thành công!");
          toast.success("Đã cập nhật ảnh đại diện thành công!");
          setTimeout(() => setMessage(""), 3000);
        } catch (error) {
          console.error("Lỗi cập nhật ảnh đại diện:", error);
          setMessage("Có lỗi xảy ra khi lưu ảnh đại diện.");
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
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, {
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
      console.error("Lỗi khi cập nhật hồ sơ:", error);
      setMessage("Có lỗi xảy ra khi cập nhật hồ sơ. Vui lòng thử lại.");
      toast.error("Có lỗi xảy ra khi cập nhật hồ sơ.");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyRequest = async () => {
    if (!user) return;
    setSaving(true);
    setVerifyMessage("");
    try {
      // In a real app, this might trigger an admin review workflow
      // For demonstration, we'll set it to true immediately or show a pending message
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, {
        verificationPending: true
      }, { merge: true });
      setVerifyMessage("Yêu cầu xác thực đã được gửi tới Quản trị viên. Xin vui lòng chờ.");
      toast.success("Yêu cầu xác thực đã được gửi tới Quản trị viên.");
    } catch (error) {
      setVerifyMessage("Không thể gửi yêu cầu xác thực.");
      toast.error("Không thể gửi yêu cầu xác thực.");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePrivacy = async (field: 'hideEmail' | 'hidePhone') => {
    if (!user) return;
    const newValue = !profileData[field];
    
    // Optimistic update
    setProfileData(prev => ({ ...prev, [field]: newValue }));
    
    try {
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, {
        [field]: newValue
      }, { merge: true });
      toast.success("Đã cập nhật cài đặt riêng tư thành công!");
    } catch (error) {
      console.error("Lỗi cập nhật riêng tư:", error);
      // rollback
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
            <p className="text-sm text-slate-500 mt-1">Quản lý thông tin tài khoản và xác thực giáo viên</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Verification Status */}
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
              <p className="text-sm text-slate-500 mb-4">{profileData.workplace || "Chưa cập nhật nơi công tác"}</p>
              
              <div className="pt-4 border-t border-slate-100">
                <div className="flex flex-col items-center gap-3">
                  <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                    profileData.package === 'enterprise' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                    profileData.package === 'pro' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    <ShieldCheck className="w-4 h-4" /> 
                    {profileData.package === 'enterprise' ? 'Gói Enterprise' : 
                     profileData.package === 'pro' ? 'Gói Pro' : 'Gói Cơ bản (Miễn phí)'}
                  </div>
                  
                  {profileData.package && profileData.package !== 'free' && profileData.expiresAt ? (
                     <p className="text-xs text-slate-500">
                       Hết hạn: <span className="font-semibold">{new Date(profileData.expiresAt).toLocaleDateString('vi-VN')}</span>
                     </p>
                  ) : (
                     <p className="text-xs text-slate-500 px-4">
                       Bạn đang sử dụng phiên bản giới hạn (2 lượt tạo/tài khoản).
                     </p>
                  )}
                  
                  <div className="w-full">
                    <button 
                      className={`mt-2 w-full flex items-center justify-center gap-2 ${profileData.package && profileData.package !== 'free' && profileData.expiresAt ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-blue-600 hover:bg-blue-500'} text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer`}
                      onClick={() => setShowUpgradeOptions(!showUpgradeOptions)}
                    >
                      <Sparkles className="w-4 h-4 animate-pulse" /> {profileData.package && profileData.package !== 'free' && profileData.expiresAt ? 'Gia hạn tài khoản' : 'Nâng cấp tài khoản ngay'}
                    </button>
                    
                    {showUpgradeOptions && (
                      <div className="mt-3 text-left border-t border-slate-100 pt-3 space-y-2 animate-fade-in">
                        <p className="text-[11px] text-slate-500 font-semibold mb-1">Chọn gói đăng ký:</p>
                        
                        <button 
                          onClick={() => setSelectedPackage({ key: 'pro', label: '1 Tháng (Pro)', price: '80.000đ', days: 30 })}
                          className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 text-left transition-colors flex justify-between items-center cursor-pointer group"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-800">Gói Pro - 1 Tháng</p>
                            <p className="text-[10px] text-slate-500">Đầy đủ chức năng</p>
                          </div>
                          <span className="text-xs font-extrabold text-blue-600">80.000đ</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600"/> Lợi ích xác thực
              </h3>
              <ul className="text-xs text-blue-800 space-y-2 list-disc list-inside">
                <li>Sử dụng không giới hạn AI Video Studio</li>
                <li>Hỗ trợ xử lý tài liệu khối lượng lớn</li>
                <li>Lưu trữ bài giảng không giới hạn</li>
                <li>Tham gia cộng đồng giáo viên VIP</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Edit Form & Privacy Settings */}
          <div className="col-span-1 md:col-span-2 space-y-6">
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
                      <p className="text-amber-800/95 mt-0.5 leading-relaxed">Hồ sơ của thầy cô đã được cập nhật đầy đủ thông tin (Họ tên, SĐT, Nơi công tác) và đã được khóa tự động để bảo vệ quyền lợi hội viên. Vui lòng liên hệ với ban quản trị nếu cần sửa đổi.</p>
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
                        <Mail className="w-4 h-4 text-slate-400" /> Email nội bộ
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

            {/* Cài đặt riêng tư */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" /> Cài đặt riêng tư
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Kiểm soát thông tin nào được hiển thị công khai với đồng nghiệp trên hệ thống.
                </p>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Email Privacy */}
                <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="space-y-0.5 pr-4">
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer" onClick={() => handleTogglePrivacy('hideEmail')}>
                      <Mail className="w-4 h-4 text-slate-400" /> Ẩn Email liên hệ
                    </label>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Khi bật, địa chỉ Email của thầy cô sẽ hiển thị là "Đã ẩn để bảo mật" trong danh bạ đồng nghiệp.
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

                {/* Phone Privacy */}
                <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="space-y-0.5 pr-4">
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer" onClick={() => handleTogglePrivacy('hidePhone')}>
                      <Phone className="w-4 h-4 text-slate-400" /> Ẩn Số điện thoại
                    </label>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Khi bật, số điện thoại của thầy cô sẽ hiển thị là "Đã ẩn để bảo mật" trong danh bạ đồng nghiệp.
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

            {/* Lịch sử mua tài liệu */}
            <PurchasedItems />
          </div>
        </div>
      </div>

      {/* Interactive Billing Modal */}
      {selectedPackage && (
        <PaymentModal
          user={user}
          userProfile={profileData}
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
    </Layout>
  );
}
