import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate, Link, useSearchParams } from "react-router";
import { BookOpen, ShieldCheck, ShieldAlert, CircleAlert as AlertCircle, Building, CircleCheck as CheckCircle2 } from "lucide-react";
import { notifyNewUser } from "../lib/telegram";

interface ProfessionalError {
  title: string;
  message: string;
  tip?: string;
}

function parseFirebaseError(err: any): ProfessionalError {
  const errCode = err.code || "";
  const errMsg = err.message || "";
  
  switch (errCode) {
    case "auth/email-already-in-use":
      return {
        title: "Tài khoản đã tồn tại",
        message: "Địa chỉ email này đã được sử dụng để đăng ký một tài khoản khác trong hệ thống.",
        tip: "Hãy thử đăng nhập bằng email này hoặc khôi phục mật khẩu nếu thầy cô quên."
      };
    case "auth/weak-password":
      return {
        title: "Mật khẩu chưa đủ mạnh",
        message: "Mật khẩu cung cấp quá yếu so với tiêu chuẩn bảo mật tối thiểu.",
        tip: "Mật khẩu phải chứa ít nhất 6 ký tự và nên kết hợp chữ, số, ký tự đặc biệt."
      };
    case "auth/invalid-email":
      return {
        title: "Định dạng Email không hợp lệ",
        message: "Địa chỉ email nội bộ bạn nhập không đúng cú pháp quy chuẩn (ví dụ: name@school.edu.vn).",
        tip: "Hãy kiểm tra lại các ký tự đặc biệt hoặc khoảng trắng thừa trong email."
      };
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return {
        title: "Thông tin xác thực sai lệch",
        message: "Email hoặc mật khẩu truy cập không chính xác, hoặc tài khoản chưa được phê duyệt.",
        tip: "Nếu thầy cô là thành viên mới, vui lòng Đăng ký để được cấp tài khoản sử dụng."
      };
    case "auth/operation-not-allowed":
      return {
        title: "Cổng đăng nhập đang bảo trì",
        message: "Phương thức đăng nhập bằng Email/Mật khẩu chưa được kích hoạt trong hệ thống Firebase.",
        tip: "Vui lòng liên hệ Kỹ thuật viên để bật cấu hình 'Email/Password Provider'."
      };
    case "auth/network-request-failed":
      return {
        title: "Sự cố kết nối mạng",
        message: "Không thể thiết lập kết nối an toàn tới máy chủ xác thực do đường truyền mạng kém.",
        tip: "Kiểm tra lại tín hiệu Wifi/4G của thầy cô hoặc thử tải lại trang."
      };
    case "auth/too-many-requests":
      return {
        title: "Tài khoản tạm thời bị khóa",
        message: "Hệ thống phát hiện quá nhiều nỗ lực đăng nhập thất bại liên tiếp từ thiết bị này.",
        tip: "Vui lòng đợi vài phút trước khi thử lại hoặc thực hiện đặt lại mật khẩu."
      };
    default:
      if (errMsg.includes("firestore-error: permission-denied") || errCode === "permission-denied") {
        return {
          title: "Lỗi phân quyền dữ liệu",
          message: "Tài khoản đã được khởi tạo thành công trên hệ thống Auth, nhưng cơ sở dữ liệu Firestore từ chối phân quyền.",
          tip: "Vui lòng liên hệ Quản trị viên để cấu hình lại quy tắc bảo mật (Security Rules)."
        };
      }
      return {
        title: "Lỗi hệ thống không xác định",
        message: errMsg || "Đã xảy ra sự cố kỹ thuật trong quá trình xác thực thông tin.",
        tip: "Vui lòng chụp lại màn hình lỗi này và gửi cho bộ phận hỗ trợ kỹ thuật."
      };
  }
}

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Enhanced Workplace and Verification States
  const [workplaceType, setWorkplaceType] = useState("Trường THPT");
  const [workplaceName, setWorkplaceName] = useState("");
  
  // Real-time Field Errors
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  const [workplaceError, setWorkplaceError] = useState("");

  // Professional Error Object
  const [errorObj, setErrorObj] = useState<ProfessionalError | null>(null);

  // Validation Helpers
  const validatePhone = (num: string): string => {
    const cleaned = num.replace(/\s+/g, "");
    if (!cleaned) return "Số điện thoại không được để trống.";
    const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
    if (!phoneRegex.test(cleaned)) {
      return "Số điện thoại không hợp lệ (Phải bắt đầu bằng 03, 05, 07, 08, 09 và gồm đúng 10 chữ số).";
    }
    return "";
  };

  const validateEmail = (emailStr: string): string => {
    const trimmed = emailStr.trim();
    if (!trimmed) return "Địa chỉ email không được để trống.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return "Email không đúng định dạng (Ví dụ: giao-vien@school.edu.vn).";
    }
    return "";
  };

  const validatePassword = (pass: string): string => {
    if (!pass) return "Mật khẩu không được để trống.";
    if (pass.length < 6) {
      return "Mật khẩu bảo mật phải có độ dài tối thiểu là 6 ký tự.";
    }
    return "";
  };

  // Real-time Event Handlers
  const handlePhoneChange = (val: string) => {
    const digitsOnly = val.replace(/[^0-9]/g, ""); // strip non-numeric characters automatically
    setPhone(digitsOnly);
    if (phoneError) {
      setPhoneError(validatePhone(digitsOnly));
    }
  };

  const handlePhoneBlur = () => {
    setPhoneError(validatePhone(phone));
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (emailError) {
      setEmailError(validateEmail(val));
    }
  };

  const handleEmailBlur = () => {
    setEmailError(validateEmail(email));
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (passwordError) {
      setPasswordError(validatePassword(val));
    }
  };

  const handlePasswordBlur = () => {
    setPasswordError(validatePassword(password));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorObj(null);
    setLoading(true);

    const pkg = searchParams.get("pkg") || "free";
    const daysStr = searchParams.get("days") || "";
    let expiresAt: string | null = null;
    
    if (pkg !== "free" && daysStr) {
      const days = parseInt(daysStr, 10);
      const date = new Date();
      date.setDate(date.getDate() + days);
      expiresAt = date.toISOString();
    }

    const finalWorkplace = workplaceType === "Khác" || !workplaceType ? workplaceName.trim() : `${workplaceType} ${workplaceName.trim()}`;

    // Verify registration details beforehand
    if (!isLogin) {
      const pErr = validatePhone(phone);
      const eErr = validateEmail(email);
      const passErr = validatePassword(password);
      const nErr = !name.trim() ? "Họ và tên không được để trống." : "";
      const wErr = !workplaceName.trim() ? "Tên trường / đơn vị không được để trống." : "";

      setPhoneError(pErr);
      setEmailError(eErr);
      setPasswordError(passErr);
      setNameError(nErr);
      setWorkplaceError(wErr);

      if (pErr || eErr || passErr || nErr || wErr) {
        setLoading(false);
        setErrorObj({
          title: "Thông tin không hợp lệ",
          message: "Vui lòng hoàn thiện chính xác các trường thông tin đăng ký bên dưới trước khi gửi yêu cầu."
        });
        return;
      }
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(userCredential.user, { displayName: name.trim() });
        
        try {
          await setDoc(doc(db, "users", userCredential.user.uid), {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            workplace: finalWorkplace,
            workplaceType,
            workplaceName: workplaceName.trim(),
            package: pkg,
            expiresAt,
            coins: 0,
            createdAt: new Date()
          });
          notifyNewUser(userCredential.user.uid, name.trim(), email.trim());
        } catch (firestoreErr: any) {
          console.error("Lỗi khi ghi dữ liệu người dùng vào Firestore:", firestoreErr);
          throw new Error(`firestore-error: ${firestoreErr.code || firestoreErr.message}`);
        }
      }
      navigate("/");
    } catch (err: any) {
      console.error("Lỗi xác thực / đăng ký:", err);
      const parsed = parseFirebaseError(err);
      setErrorObj(parsed);
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <Link to="/" className="flex items-center gap-2 mb-8 group">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 duration-200">
              <BookOpen className="text-white h-5 w-5" />
            </div>
            <span className="font-bold text-2xl text-slate-900 tracking-tight">EduCreate</span>
          </Link>

          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            {isLogin ? "Đăng nhập hệ thống" : "Đăng ký tài khoản"}
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-medium mb-8">
            Cổng thông tin quản trị học liệu thông minh
          </p>

          {/* Premium styled professional error banner */}
          {errorObj && (
            <div className="bg-red-50 border-l-4 border-red-600 rounded-r-xl p-4 mb-6 shadow-sm flex items-start gap-3 text-left">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5 animate-bounce" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-red-900 leading-none">{errorObj.title}</h4>
                <p className="text-xs text-red-700 leading-relaxed font-medium">{errorObj.message}</p>
                {errorObj.tip && (
                  <p className="text-[11px] text-slate-600 italic mt-1.5 bg-red-100/50 px-2 py-1 rounded border border-red-200/30">
                    <span className="font-semibold text-slate-700 not-italic">💡 Gợi ý:</span> {errorObj.tip}
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Họ và Tên</label>
                  <input 
                    type="text" 
                    required 
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError("");
                    }}
                    placeholder="Ví dụ: Nguyễn Văn A"
                    className={`block w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      nameError ? "border-red-300 bg-red-50/30" : "border-slate-300"
                    }`}
                  />
                  {nameError && (
                    <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {nameError}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-semibold text-slate-700">Số điện thoại</label>
                    {phone && !phoneError && (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">✓ Số hợp lệ</span>
                    )}
                  </div>
                  <input 
                    type="tel" 
                    required 
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onBlur={handlePhoneBlur}
                    placeholder="Ví dụ: 0912345678"
                    className={`block w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      phoneError ? "border-red-300 bg-red-50/30" : phone && !phoneError ? "border-emerald-300" : "border-slate-300"
                    }`}
                  />
                  {phoneError && (
                    <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> {phoneError}
                    </p>
                  )}
                </div>

                {/* Place of Work Fields */}
                <div className="space-y-4 bg-slate-100/50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider mb-1">
                    <Building className="w-4 h-4 text-blue-600" />
                    <span>Nơi Công Tác</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Cấp học / Loại hình đơn vị</label>
                    <select
                      value={workplaceType}
                      onChange={(e) => setWorkplaceType(e.target.value)}
                      className="block w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white font-medium"
                    >
                      <option value="Trường Tiểu học">Trường Tiểu học</option>
                      <option value="Trường THCS">Trường THCS</option>
                      <option value="Trường THPT">Trường THPT</option>
                      <option value="Trường THPT Chuyên">Trường THPT Chuyên</option>
                      <option value="Trường Liên cấp">Trường Liên cấp (K12)</option>
                      <option value="Đại học / Cao đẳng">Đại học / Cao đẳng</option>
                      <option value="Sở / Phòng Giáo dục">Sở / Phòng Giáo dục</option>
                      <option value="Trung tâm Giáo dục">Trung tâm Giáo dục</option>
                      <option value="Khác">Đơn vị đào tạo khác...</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tên trường học / Cơ quan</label>
                    <input 
                      type="text" 
                      required 
                      value={workplaceName}
                      onChange={(e) => {
                        setWorkplaceName(e.target.value);
                        if (workplaceError) setWorkplaceError("");
                      }}
                      placeholder={workplaceType === "Khác" ? "Nhập tên đơn vị công tác" : "Ví dụ: Chuyên Hà Nội - Amsterdam"}
                      className={`block w-full px-3 py-1.5 border rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                        workplaceError ? "border-red-300 bg-red-50/30" : "border-slate-300 bg-white"
                      }`}
                    />
                    {workplaceError && (
                      <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {workplaceError}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email nội bộ</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                placeholder="giao-vien@school.edu.vn"
                className={`block w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  emailError ? "border-red-300 bg-red-50/30" : "border-slate-300"
                }`}
              />
              {emailError && (
                <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> {emailError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Mật khẩu truy cập</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={handlePasswordBlur}
                placeholder="Tối thiểu 6 ký tự"
                className={`block w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  passwordError ? "border-red-300 bg-red-50/30" : "border-slate-300"
                }`}
              />
              {passwordError && (
                <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> {passwordError}
                </p>
              )}
            </div>

            {isLogin && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded" />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700">Lưu thông tin</label>
                </div>
                <div className="text-sm">
                  <a href="#" className="font-medium text-blue-600 hover:text-blue-500">Quên mật khẩu?</a>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? "Đang xác thực..." : (isLogin ? "Đăng nhập" : "Đăng ký")}
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-600 text-center">
            {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}
            <button 
              onClick={() => {
                setIsLogin(!isLogin);
                setErrorObj(null);
                setError("");
              }} 
              className="ml-1 font-semibold text-blue-600 hover:text-blue-500 cursor-pointer"
            >
              {isLogin ? "Yêu cầu cấp tài khoản" : "Trở về đăng nhập"}
            </button>
          </div>
        </div>
      </div>
      <div className="hidden lg:block relative w-0 flex-1 bg-slate-900 overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-slate-900 opacity-90 mix-blend-multiply"></div>
         {/* Decorative abstract elements */}
         <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl"></div>
         <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl"></div>
         
         <div className="relative z-10 flex flex-col justify-center h-full px-20 text-white animate-fade-in">
            <h2 className="text-4xl font-bold mb-6">Nền tảng Quản trị <br/> Học liệu Tự động</h2>
            <p className="text-lg text-slate-300 max-w-lg leading-relaxed">
              Dành riêng cho giáo viên và các cơ sở giáo dục hiện đại. Tối ưu hóa quy trình, bảo mật dữ liệu, và tăng cường chất lượng giảng dạy.
            </p>
         </div>
      </div>
    </div>
  );
}
