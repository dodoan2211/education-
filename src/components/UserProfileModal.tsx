import { useState, useEffect } from "react";
import { X, ShieldCheck, Mail, Phone, MapPin, Sparkles, Loader2, BookOpen, Clock, Award, Globe, MessageSquare, UserPlus, UserMinus } from "lucide-react";
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit, addDoc, deleteDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { useChat } from "../context/ChatContext";

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
  onFollowChange?: () => void;
  fallbackName?: string;
  fallbackAvatar?: string;
}

interface ProfileData {
  name: string;
  email: string;
  phone?: string;
  workplace?: string;
  verified?: boolean;
  package?: string;
  avatar?: string;
  hideEmail?: boolean;
  hidePhone?: boolean;
}

interface MiniPost {
  id: string;
  content: string;
  imageUrl?: string;
  createdAt: any;
}

export default function UserProfileModal({ userId, onClose, onFollowChange, fallbackName, fallbackAvatar }: UserProfileModalProps) {
  const { user } = useAuth();
  const { openChatWithUser } = useChat();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<MiniPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  useEffect(() => {
    const checkFollowing = async () => {
      if (!user || user.uid === userId) return;
      try {
        const q = query(
          collection(db, "follows"),
          where("followerId", "==", user.uid),
          where("followingId", "==", userId)
        );
        const snap = await getDocs(q);
        setIsFollowing(!snap.empty);
      } catch (err) {
        console.error("Lỗi kiểm tra theo dõi:", err);
      }
    };
    checkFollowing();
  }, [user, userId]);

  const handleFollow = async () => {
    if (!user) return;
    setFollowingLoading(true);
    try {
      if (isFollowing) {
        const q = query(
          collection(db, "follows"),
          where("followerId", "==", user.uid),
          where("followingId", "==", userId)
        );
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        setIsFollowing(false);
        if (onFollowChange) onFollowChange();
      } else {
        await addDoc(collection(db, "follows"), {
          followerId: user.uid,
          followingId: userId,
          createdAt: serverTimestamp()
        });
        setIsFollowing(true);
        if (onFollowChange) onFollowChange();

        // Notification for follow
        await addDoc(collection(db, "notifications"), {
          userId: userId,
          fromUserId: user.uid,
          fromUserName: profile?.name || user.displayName || "Đồng nghiệp",
          type: "general",
          title: "Người theo dõi mới",
          message: `${profile?.name || user.displayName || "Ai đó"} đã bắt đầu theo dõi bạn.`,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Lỗi xử lý theo dõi:", err);
    } finally {
      setFollowingLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        // Fetch public user profile
        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as ProfileData);
        } else {
          // Use fallbacks
          setProfile({
            name: fallbackName || "Giáo viên EduCreate",
            email: "Chưa cập nhật",
            avatar: fallbackAvatar || "",
            package: "free"
          });
        }

        // Fetch user's posts
        setLoadingPosts(true);
        if (userId && !userId.startsWith("system_") && userId !== "demo-uid") {
          const postsQuery = query(
            collection(db, "posts"),
            where("userId", "==", userId)
          );
          const postsSnap = await getDocs(postsQuery);
          const fetchedPosts: MiniPost[] = [];
          postsSnap.forEach((doc) => {
            const data = doc.data();
            fetchedPosts.push({
              id: doc.id,
              content: data.content,
              imageUrl: data.imageUrl,
              createdAt: data.createdAt
            });
          });
          
          // In-memory sort descending by createdAt
          const getMs = (val: any) => {
            if (!val) return 0;
            if (val.seconds) return val.seconds * 1000;
            if (val.toDate) return val.toDate().getTime();
            return new Date(val).getTime() || 0;
          };
          
          fetchedPosts.sort((a, b) => getMs(b.createdAt) - getMs(a.createdAt));
          setPosts(fetchedPosts.slice(0, 5));
        } else {
          setPosts([]);
        }
      } catch (err) {
        console.error("Lỗi tải thông tin cá nhân giáo viên:", err);
      } finally {
        setLoading(false);
        setLoadingPosts(false);
      }
    };

    fetchUserData();
  }, [userId]);

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "vừa xong";
    let date: Date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-150 overflow-hidden relative flex flex-col my-8">
        
        {/* Modal Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all z-20 cursor-pointer border border-slate-200"
        >
          <X className="w-4 h-4" />
        </button>

        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500 text-sm font-medium">Đang tải hồ sơ đồng nghiệp...</p>
          </div>
        ) : profile ? (
          <>
            {/* Top Cover background design */}
            <div className="h-28 bg-gradient-to-r from-blue-500 to-indigo-600 relative shrink-0">
              <div className="absolute top-3 left-4 flex gap-2">
                <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                  Giáo viên cộng đồng
                </span>
              </div>
            </div>

            {/* Profile Info Container */}
            <div className="px-6 pb-6 relative -mt-10 flex-grow overflow-y-auto max-h-[70vh]">
              {/* Avatar and Badges */}
              <div className="flex justify-between items-end mb-4">
                <div className="relative">
                  {profile.avatar ? (
                    <img 
                      src={profile.avatar} 
                      alt={profile.name} 
                      className="w-20 h-20 rounded-2xl object-cover border-4 border-white bg-white shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-slate-100 to-blue-50 border-4 border-white text-blue-600 font-extrabold text-2xl flex items-center justify-center shadow-md">
                      {profile.name?.[0]?.toUpperCase() || "T"}
                    </div>
                  )}
                  {profile.verified !== false && (
                    <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 border-2 border-white shadow-sm flex items-center justify-center">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {profile.package === "admin" && (
                    <span className="px-2.5 py-1 bg-red-50 border border-red-100 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" /> Admin
                    </span>
                  )}
                  {profile.package === "pro" && (
                    <span className="px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Pro Teacher
                    </span>
                  )}
                  {profile.package === "enterprise" && (
                    <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Enterprise
                    </span>
                  )}
                  {(!profile.package || profile.package === "free") && (
                    <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm">
                      Free Member
                    </span>
                  )}
                </div>
              </div>

              {/* User Meta */}
              <div className="mb-6">
                <h3 className="text-xl font-black text-slate-900 leading-tight mb-1">{profile.name}</h3>
                <p className="text-slate-500 text-xs font-semibold flex items-center gap-1.5 mt-1.5">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{profile.workplace || "Chưa cập nhật nơi công tác"}</span>
                </p>
              </div>

              {/* Grid Contact Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email liên hệ</p>
                    <p className="text-xs text-slate-700 font-medium truncate">
                      {profile.hideEmail ? (
                        <span className="text-slate-400 italic">Đã ẩn (Bảo mật)</span>
                      ) : (
                        profile.email || "Chưa chia sẻ"
                      )}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số điện thoại</p>
                    <p className="text-xs text-slate-700 font-medium truncate">
                      {profile.hidePhone ? (
                        <span className="text-slate-400 italic">Đã ẩn (Bảo mật)</span>
                      ) : (
                        profile.phone || "Chưa chia sẻ"
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              {user && user.uid !== userId && (
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={handleFollow}
                    disabled={followingLoading}
                    className={`flex-grow py-2.5 px-4 rounded-2xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isFollowing 
                        ? "bg-slate-100 text-slate-600 hover:bg-slate-200 shadow-slate-100" 
                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100"
                    }`}
                  >
                    {followingLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <UserMinus className="w-4 h-4" /> Đang theo dõi
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" /> Theo dõi
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      openChatWithUser(userId, profile.name, profile.avatar);
                      onClose();
                    }}
                    className="flex-grow py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-blue-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" /> Nhắn tin
                  </button>
                </div>
              )}

              {/* Recent Images Gallery (if any) */}
              {!loadingPosts && posts.some(p => p.imageUrl) && (
                <div className="mb-6">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Hình ảnh chia sẻ ({posts.filter(p => p.imageUrl).length})
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {posts.filter(p => p.imageUrl).map((post) => (
                      <div 
                        key={`gal-${post.id}`} 
                        className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative group cursor-pointer shadow-sm"
                      >
                        <img 
                          src={post.imageUrl} 
                          alt="Recent sharing" 
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mini feed posts history */}
              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" /> Bài viết gần đây
                </h4>
                
                {loadingPosts ? (
                  <div className="py-6 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
                  </div>
                ) : posts.length === 0 ? (
                  <p className="text-slate-400 text-xs italic py-4">Giáo viên này chưa chia sẻ bài đăng nào.</p>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <div key={post.id} className="group">
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/20 transition-all flex flex-col gap-2">
                          <p className="text-slate-700 text-xs leading-relaxed line-clamp-3 whitespace-pre-line font-medium">
                            {post.content}
                          </p>
                          {post.imageUrl && (
                            <div className="w-full aspect-[16/9] rounded-xl overflow-hidden bg-slate-200 border border-slate-200/50 mt-1 shadow-inner">
                              <img 
                                src={post.imageUrl} 
                                alt="Attachment" 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                              <Clock className="w-3 h-3 text-slate-300" />
                              {formatTime(post.createdAt)}
                            </span>
                            {post.imageUrl && (
                              <span className="text-[9px] bg-white px-1.5 py-0.5 rounded border border-slate-100 text-slate-400 font-black uppercase tracking-tighter">Photo</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="py-24 text-center">
            <p className="text-slate-500 text-sm">Không tìm thấy thông tin giáo viên này.</p>
          </div>
        )}
      </div>
    </div>
  );
}
