import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { Heart, Send, Image as ImageIcon, Trash2, Globe, Sparkles, Check, Loader as Loader2, Info, X, MessageSquare, CircleAlert as AlertCircle, MoveHorizontal as MoreHorizontal, Share2, CreditCard as Edit2, UserPlus, UserMinus, ShieldCheck } from "lucide-react";
import { db, auth } from "../firebase";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, where, writeBatch, setDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { useToast } from "../context/ToastContext";
import UserProfileModal from "./UserProfileModal";
import { motion, AnimatePresence } from "motion/react";
import { notifyNewPost } from "../lib/telegram";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userPackage?: string;
  content: string;
  imageUrl?: string;
  likes: string[]; // array of user UIDs
  loves: string[]; // array of user UIDs
  commentsCount: number;
  createdAt: any;
}

interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: any;
  parentId?: string;
  replyToName?: string;
}

export default function CommunityFeed() {
  const { user, userProfile, isAdmin } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"foryou" | "following">("foryou");
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  
  // New post states
  const [postContent, setPostContent] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedProfile, setSelectedProfile] = useState<{
    userId: string;
    fallbackName?: string;
    fallbackAvatar?: string;
  } | null>(null);

  const [searchParams] = useSearchParams();
  const highlightPostId = searchParams.get("post");

  useEffect(() => {
    if (highlightPostId && posts.length > 0) {
      // Ensure we are on the right tab if it's a specific post we're looking for
      const postExists = posts.find(p => p.id === highlightPostId);
      if (postExists) {
        setTimeout(() => {
          const el = document.getElementById(`post-${highlightPostId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-blue-500', 'ring-offset-4');
            setTimeout(() => {
              el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-4');
            }, 3000);
          }
        }, 500);
      }
    }
  }, [highlightPostId, posts]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let q;
      if (activeTab === "following" && user) {
        // Include user's own ID in the following list to show their own posts too
        const allIds = Array.from(new Set([user.uid, ...followingIds]));
        const limitedIds = allIds.slice(0, 10);
        
        console.log("Fetching following feed for IDs:", limitedIds);
        
        q = query(
          collection(db, "posts"), 
          where("userId", "in", limitedIds)
        );
      } else {
        q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      }

      const snapshot = await getDocs(q);
      const items: Post[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        items.push({
          id: docSnap.id,
          userId: data.userId,
          userName: data.userName,
          userAvatar: data.userAvatar,
          userPackage: data.userPackage,
          content: data.content,
          imageUrl: data.imageUrl,
          likes: data.likes || [],
          loves: data.loves || [],
          commentsCount: data.commentsCount || 0,
          createdAt: data.createdAt
        });
      });

      // Sort client-side for following tab to avoid index requirement
      if (activeTab === "following") {
        items.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
      }

      setPosts(items);
    } catch (err) {
      console.error("Lỗi tải bài đăng cộng đồng:", err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowing = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, "follows"), where("followerId", "==", user.uid));
      const snapshot = await getDocs(q);
      const ids = snapshot.docs.map(doc => doc.data().followingId);
      setFollowingIds(ids);
    } catch (err) {
      console.error("Lỗi tải danh sách theo dõi:", err);
    }
  };

  useEffect(() => {
    fetchFollowing();
  }, [user, activeTab]);

  useEffect(() => {
    fetchPosts();
  }, [activeTab, followingIds]);

  // Utility to downscale & compress image client side to keep Firestore storage tiny (<100KB)
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn tệp hình ảnh hợp lệ!");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Hình ảnh quá lớn! Vui lòng chọn ảnh dưới 8MB.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9); // 90% quality
        setPostImage(dataUrl);
      };
    };
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Vui lòng đăng nhập để đăng bài lên cộng đồng!");
      return;
    }

    if (!postContent.trim() && !postImage) {
      toast.error("Nội dung bài viết không được để trống!");
      return;
    }

    setPublishing(true);
    try {
      const newPostData = {
        userId: user.uid,
        userName: userProfile?.name || user.displayName || user.email?.split("@")[0] || "Giáo viên ẩn danh",
        userAvatar: userProfile?.avatar || "",
        userPackage: userProfile?.package || "free",
        content: postContent.trim(),
        imageUrl: postImage || "",
        likes: [],
        loves: [],
        commentsCount: 0,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "posts"), newPostData);

      notifyNewPost(
        docRef.id,
        newPostData.userName,
        user.email || '',
        newPostData.content,
        newPostData.imageUrl || undefined
      );
      
      // Update local state proactively
      const localPost: Post = {
        id: docRef.id,
        ...newPostData,
        createdAt: { seconds: Date.now() / 1000 } // Mock timestamp
      };

      setPosts([localPost, ...posts]);
      setPostContent("");
      setPostImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Đã đăng bài viết mới thành công!");
    } catch (err) {
      console.error("Lỗi khi đăng bài:", err);
      toast.error("Đăng bài thất bại. Vui lòng thử lại!");
      handleFirestoreError(err, OperationType.CREATE, "posts");
    } finally {
      setPublishing(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, "posts", postId));
      setPosts(posts.filter(p => p.id !== postId));
      toast.success("Đã xóa bài viết thành công.");
    } catch (err: any) {
      console.error("Lỗi khi xóa bài viết:", err);
      const errorMessage = err?.message || "Không thể xóa bài viết này.";
      toast.error(`Lỗi: ${errorMessage}`);
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return "vừa xong";
    let date: Date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return "vài giây trước";
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHr < 24) return `${diffHr} giờ trước`;
    return `${diffDay} ngày trước`;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Tabs Switcher */}
      <div className="flex items-center gap-1 mb-6 bg-slate-100/50 p-1 rounded-2xl w-fit border border-slate-200">
        <button
          onClick={() => setActiveTab("foryou")}
          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "foryou" 
              ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          }`}
        >
          Dành cho bạn
        </button>
        <button
          onClick={() => {
            if (!user) {
              toast.error("Vui lòng đăng nhập để xem những người bạn đang theo dõi!");
              return;
            }
            setActiveTab("following");
          }}
          className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "following" 
              ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          }`}
        >
          Đang theo dõi
          {user && followingIds.length > 0 && (
            <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md text-[10px]">
              {followingIds.length}
            </span>
          )}
        </button>
      </div>

      {/* Post Creator Box */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm mb-6">
        <div className="flex gap-3 items-start mb-4">
          {userProfile?.avatar ? (
            <img 
              src={userProfile.avatar} 
              alt="Avatar" 
              className="w-10 h-10 rounded-full object-cover border border-slate-100 shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 border border-slate-200">
              {userProfile?.name?.[0] || user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
          )}
          <div className="flex-grow">
            <textarea
              rows={3}
              placeholder={user ? `Thầy/Cô ${userProfile?.name || user.displayName || ""} đang nghĩ gì thế? Chia sẻ kiến thức nhé...` : "Đăng nhập để chia sẻ bài viết, giáo án, hình ảnh với cộng đồng giáo viên!"}
              className="w-full resize-none text-slate-800 placeholder-slate-400 border-none focus:outline-none focus:ring-0 text-sm py-1.5"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              disabled={!user || publishing}
            />
            
            {/* Image Preview */}
            {postImage && (
              <div className="relative mt-3 rounded-xl overflow-hidden border border-slate-200 max-h-[600px] bg-slate-900/5">
                <img src={postImage} alt="Post preview" className="w-full h-auto max-h-[600px] object-contain" />
                <button 
                  type="button"
                  onClick={() => setPostImage(null)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-900/70 hover:bg-slate-950/90 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => user ? fileInputRef.current?.click() : toast.error("Vui lòng đăng nhập để đăng hình ảnh!")}
            className="flex items-center gap-2 px-3.5 py-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 rounded-xl transition-all text-xs font-semibold cursor-pointer"
          >
            <ImageIcon className="w-4 h-4 text-emerald-500" />
            Đính kèm ảnh
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageSelect} 
            accept="image/*" 
            className="hidden" 
          />

          <button
            onClick={handleCreatePost}
            disabled={publishing || (!postContent.trim() && !postImage)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            {publishing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang đăng...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Đăng bài
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feed Posts */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Đang kết nối cộng đồng...</p>
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-6">
          {posts.map((post) => (
            <PostCard 
              key={post.id} 
              post={post} 
              currentUser={user} 
              userProfile={userProfile}
              isAdmin={isAdmin}
              onDelete={handleDeletePost} 
              formatTime={formatRelativeTime} 
              onFollowChange={fetchFollowing}
              onViewProfile={(userId, name, avatar) => setSelectedProfile({ userId, fallbackName: name, fallbackAvatar: avatar })}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <Globe className="w-8 h-8" />
          </div>
          <h3 className="text-slate-900 font-bold mb-1">
            {activeTab === 'following' ? "Chưa có bài viết từ người theo dõi" : "Chưa có bài viết nào"}
          </h3>
          <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">
            {activeTab === 'following' 
              ? "Hãy theo dõi thêm nhiều thầy cô khác để cập nhật kiến thức và tài liệu mới nhất!" 
              : "Hãy là người đầu tiên chia sẻ kiến thức của bạn với cộng đồng nhé!"}
          </p>
          {activeTab === 'following' && (
            <button 
              onClick={() => setActiveTab('foryou')}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-100 transition-all cursor-pointer active:scale-95"
            >
              Khám phá đồng nghiệp
            </button>
          )}
        </div>
      )}

      {/* User Profile Modal */}
      {selectedProfile && (
        <UserProfileModal 
          userId={selectedProfile.userId}
          fallbackName={selectedProfile.fallbackName}
          fallbackAvatar={selectedProfile.fallbackAvatar}
          onClose={() => setSelectedProfile(null)}
          onFollowChange={fetchFollowing}
        />
      )}
    </div>
  );
}

interface PostCardProps {
  post: Post;
  currentUser: any;
  userProfile: any;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  formatTime: (ts: any) => string;
  onFollowChange?: () => void;
  onViewProfile: (userId: string, name: string, avatar?: string) => void;
}

function PostCard({ post, currentUser, userProfile, isAdmin, onDelete, formatTime, onFollowChange, onViewProfile }: PostCardProps) {
  const { toast } = useToast();
  const [loves, setLoves] = useState<string[]>(post.loves || []);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; userName: string; userId: string } | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  
  // New upgraded states
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);

  // Check if following
  useEffect(() => {
    const checkFollowing = async () => {
      if (!currentUser || currentUser.uid === post.userId) return;
      try {
        const q = query(
          collection(db, "follows"), 
          where("followerId", "==", currentUser.uid),
          where("followingId", "==", post.userId)
        );
        const snap = await getDocs(q);
        setIsFollowing(!snap.empty);
      } catch (err) {
        console.error("Lỗi kiểm tra theo dõi:", err);
      }
    };
    checkFollowing();
  }, [currentUser, post.userId]);

  const handleFollow = async () => {
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để theo dõi giáo viên!");
      return;
    }
    setFollowingLoading(true);
    try {
      if (isFollowing) {
        const q = query(
          collection(db, "follows"), 
          where("followerId", "==", currentUser.uid),
          where("followingId", "==", post.userId)
        );
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        setIsFollowing(false);
        toast.success(`Đã bỏ theo dõi ${post.userName}`);
        if (onFollowChange) onFollowChange();
      } else {
        await addDoc(collection(db, "follows"), {
          followerId: currentUser.uid,
          followingId: post.userId,
          createdAt: serverTimestamp()
        });
        setIsFollowing(true);
        toast.success(`Đang theo dõi ${post.userName}`);
        if (onFollowChange) onFollowChange();

        // Notification for follow
        await addDoc(collection(db, "notifications"), {
          userId: post.userId,
          fromUserId: currentUser.uid,
          fromUserName: userProfile?.name || currentUser.displayName || "Đồng nghiệp",
          type: "general",
          title: "Người theo dõi mới",
          message: `${userProfile?.name || currentUser.displayName || "Ai đó"} đã bắt đầu theo dõi bạn.`,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Lỗi xử lý theo dõi:", err);
      toast.error("Không thể thực hiện thao tác này.");
    } finally {
      setFollowingLoading(false);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/community?post=${post.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Đã sao chép liên kết bài viết!");
      setShowMenu(false);
    });
  };

  const handleUpdatePost = async () => {
    if (!editContent.trim()) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "posts", post.id), {
        content: editContent.trim(),
        updatedAt: serverTimestamp()
      });
      post.content = editContent.trim();
      setIsEditing(false);
      setShowMenu(false);
      toast.success("Đã cập nhật bài viết.");
    } catch (err) {
      console.error("Lỗi cập nhật bài viết:", err);
      toast.error("Không thể cập nhật bài viết.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReplyClick = (commentId: string, userName: string, userId: string) => {
    setReplyingTo({ commentId, userName, userId });
    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }
  };

  const hasLoved = currentUser ? loves.includes(currentUser.uid) : false;

  const handleLove = async () => {
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để tương tác bài viết!");
      return;
    }

    let updatedLoves = [...loves];
    if (hasLoved) {
      updatedLoves = updatedLoves.filter(uid => uid !== currentUser.uid);
    } else {
      updatedLoves.push(currentUser.uid);
    }

    setLoves(updatedLoves);

    try {
      await updateDoc(doc(db, "posts", post.id), {
        loves: updatedLoves
      });

      // Create notification for love
      if (!hasLoved && post.userId !== currentUser.uid) {
        await addDoc(collection(db, "notifications"), {
          userId: post.userId,
          fromUserId: currentUser.uid,
          fromUserName: userProfile?.name || currentUser.displayName || "Một người dùng",
          type: "like",
          title: "Tương tác mới",
          message: `${userProfile?.name || currentUser.displayName || "Ai đó"} đã thả tim bài viết của bạn.`,
          postId: post.id,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Lỗi thả tim bài đăng:", err);
      handleFirestoreError(err, OperationType.UPDATE, `posts/${post.id}`);
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const q = query(
        collection(db, "comments"), 
        where("postId", "==", post.id)
      );
      const snap = await getDocs(q);
      const items: Comment[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as Comment);
      });
      
      // In-memory sort ascending by createdAt
      const getMs = (val: any) => {
        if (!val) return 0;
        if (val.seconds) return val.seconds * 1000;
        if (val.toDate) return val.toDate().getTime();
        return new Date(val).getTime() || 0;
      };
      
      items.sort((a, b) => getMs(a.createdAt) - getMs(b.createdAt));
      setComments(items);
    } catch (err) {
      console.error("Lỗi tải bình luận:", err);
      handleFirestoreError(err, OperationType.LIST, "comments");
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleComments = () => {
    const nextShow = !showComments;
    setShowComments(nextShow);
    if (nextShow) {
      loadComments();
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentUser) return;

    try {
      await deleteDoc(doc(db, "comments", commentId));
      setComments(prev => prev.filter(c => c.id !== commentId));
      
      // Decrement commentsCount inside post
      const newCount = Math.max(0, (post.commentsCount || 0) - 1);
      await updateDoc(doc(db, "posts", post.id), {
        commentsCount: newCount
      });
      post.commentsCount = newCount;
      
      toast.success("Đã xóa bình luận thành công!");
    } catch (err) {
      console.error("Lỗi khi xóa bình luận:", err);
      toast.error("Không thể xóa bình luận.");
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để viết bình luận!");
      return;
    }

    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const comData: any = {
        postId: post.id,
        userId: currentUser.uid,
        userName: userProfile?.name || currentUser.displayName || currentUser.email?.split("@")[0] || "Giáo viên",
        userAvatar: userProfile?.avatar || "",
        content: newComment.trim(),
        createdAt: serverTimestamp()
      };

      if (replyingTo) {
        comData.parentId = replyingTo.commentId;
        comData.replyToName = replyingTo.userName;
      }

      let newId = "local-com-" + Date.now();
      const docRef = await addDoc(collection(db, "comments"), comData);
      newId = docRef.id;

      // Create notification for comment/reply
      if (replyingTo) {
          // Notify the person who was replied to
          if (replyingTo.userId !== currentUser.uid) {
            await addDoc(collection(db, "notifications"), {
              userId: replyingTo.userId,
              fromUserId: currentUser.uid,
              fromUserName: userProfile?.name || currentUser.displayName || "Một người dùng",
              type: "reply",
              title: "Phản hồi mới",
              message: `${userProfile?.name || currentUser.displayName || "Ai đó"} đã trả lời bình luận của bạn.`,
              postId: post.id,
              commentId: newId,
              read: false,
              createdAt: serverTimestamp()
            });
          }
        } else {
          // Notify post owner
          if (post.userId !== currentUser.uid) {
            await addDoc(collection(db, "notifications"), {
              userId: post.userId,
              fromUserId: currentUser.uid,
              fromUserName: userProfile?.name || currentUser.displayName || "Một người dùng",
              type: "comment",
              title: "Bình luận mới",
              message: `${userProfile?.name || currentUser.displayName || "Ai đó"} đã bình luận bài viết của bạn.`,
              postId: post.id,
              commentId: newId,
              read: false,
              createdAt: serverTimestamp()
            });
          }
        }

        // Increment commentsCount inside post
        const newCount = (post.commentsCount || 0) + 1;
        await updateDoc(doc(db, "posts", post.id), {
          commentsCount: newCount
        });
        post.commentsCount = newCount;
      

      const localCom: Comment = {
        id: newId,
        ...comData,
        createdAt: { seconds: Date.now() / 1000 }
      };

      setComments([...comments, localCom]);
      setNewComment("");
      setReplyingTo(null);
      toast.success(replyingTo ? "Đã gửi phản hồi!" : "Đã đăng bình luận!");
    } catch (err) {
      console.error("Lỗi gửi bình luận:", err);
      toast.error("Gửi bình luận thất bại.");
      handleFirestoreError(err, OperationType.CREATE, "comments");
    } finally {
      setSubmittingComment(false);
    }
  };

  const isAuthor = currentUser && currentUser.uid === post.userId;

  return (
    <motion.div 
      id={`post-${post.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-500"
    >
      {/* Post Top bar */}
      <div className="p-5 flex justify-between items-start">
        <div className="flex gap-3">
          <div className="relative">
            {post.userAvatar ? (
              <img 
                src={post.userAvatar} 
                alt={post.userName} 
                onClick={() => onViewProfile(post.userId, post.userName, post.userAvatar)}
                className="w-10 h-10 rounded-full object-cover border border-slate-100 cursor-pointer hover:opacity-85 transition-opacity"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div 
                onClick={() => onViewProfile(post.userId, post.userName)}
                className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-slate-200 transition-colors"
              >
                {post.userName[0]?.toUpperCase()}
              </div>
            )}
            {post.userPackage === "admin" && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                <ShieldCheck className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span 
                onClick={() => onViewProfile(post.userId, post.userName, post.userAvatar)}
                className="font-bold text-slate-800 text-sm hover:text-blue-600 transition-colors cursor-pointer"
              >
                {post.userName}
              </span>
              {currentUser && currentUser.uid !== post.userId && (
                <button
                  onClick={handleFollow}
                  disabled={followingLoading}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                    isFollowing 
                      ? "text-slate-400 bg-slate-100" 
                      : "text-blue-600 bg-blue-50 hover:bg-blue-100"
                  }`}
                >
                  {followingLoading ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : isFollowing ? (
                    "Đang theo dõi"
                  ) : (
                    <>
                      <UserPlus className="w-2.5 h-2.5" /> Theo dõi
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-0.5 font-medium">
              <span>{formatTime(post.createdAt)}</span>
              <span>•</span>
              <Globe className="w-3.5 h-3.5 text-slate-350" />
            </div>
          </div>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-30"
              >
                <button 
                  onClick={handleShare}
                  className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Share2 className="w-4 h-4 text-blue-500" /> Sao chép liên kết
                </button>
                
                {isAuthor && (
                  <>
                    <button 
                      onClick={() => {
                        setIsEditing(true);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-emerald-500" /> Chỉnh sửa bài viết
                    </button>
                    <button 
                      onClick={() => {
                        onDelete(post.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Xóa bài viết
                    </button>
                  </>
                )}
                
                {isAdmin && !isAuthor && (
                  <button 
                    onClick={() => {
                      onDelete(post.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Gỡ bài (Admin)
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-4">
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-none"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button 
                onClick={handleUpdatePost}
                disabled={isUpdating || !editContent.trim()}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:bg-slate-200"
              >
                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Lưu thay đổi
              </button>
            </div>
          </div>
        ) : (
          <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line">{post.content}</p>
        )}
      </div>

      {/* Post Image */}
      {post.imageUrl && (
        <div className="border-y border-slate-100 bg-slate-900/5 flex items-center justify-center overflow-hidden">
          <img 
            src={post.imageUrl} 
            alt="Post Attachment" 
            className="w-full h-auto max-h-[800px] object-contain" 
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Action count stats */}
      <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-3">
          {loves.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-5 h-5 rounded-full bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shadow-sm shrink-0">
                <Heart className="w-3 h-3 fill-red-600" />
              </span>
              <span><b>{loves.length}</b> thả tim</span>
            </span>
          )}
          {loves.length === 0 && (
            <span className="text-slate-400">Trở thành người đầu tiên thả tim bài đăng này</span>
          )}
        </div>
        <button 
          onClick={toggleComments}
          className="hover:underline text-slate-500 font-semibold cursor-pointer"
        >
          {post.commentsCount || 0} bình luận
        </button>
      </div>

      {/* Action buttons */}
      <div className="px-2 py-1.5 flex justify-around border-b border-slate-100 bg-slate-50/30">
        <button
          onClick={handleLove}
          className={`flex-grow flex items-center justify-center gap-2 py-2 px-1 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            hasLoved 
              ? "text-red-600 bg-red-50/50" 
              : "text-slate-600 hover:text-red-600 hover:bg-slate-100/70"
          }`}
        >
          <Heart className={`w-4 h-4 ${hasLoved ? "fill-red-600" : ""}`} />
          <span className="hidden sm:inline">Thả tim</span>
        </button>

        <button
          onClick={toggleComments}
          className={`flex-grow flex items-center justify-center gap-2 py-2 px-1 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            showComments 
              ? "text-indigo-600 bg-indigo-50/50" 
              : "text-slate-600 hover:text-indigo-600 hover:bg-slate-100/70"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Bình luận</span>
        </button>

        <button
          onClick={handleShare}
          className="flex-grow flex items-center justify-center gap-2 py-2 px-1 sm:px-3 rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-600 hover:bg-slate-100/70 transition-all cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Chia sẻ</span>
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="bg-slate-50/50 p-4 border-t border-slate-100 space-y-4">
          {/* New Comment input */}
          <div className="flex flex-col gap-2">
            {replyingTo && (
              <div className="flex items-center justify-between bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-xl border border-blue-100 font-semibold animate-fade-in">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  Đang trả lời thầy cô <span className="underline">{replyingTo.userName}</span>
                </span>
                <button 
                  onClick={() => setReplyingTo(null)}
                  className="text-blue-400 hover:text-blue-700 p-0.5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <form onSubmit={handleAddComment} className="flex gap-2 items-center">
              {userProfile?.avatar ? (
                <img 
                  src={userProfile.avatar} 
                  alt="Avatar" 
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0 border border-slate-300">
                  {currentUser?.email?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <input 
                ref={commentInputRef}
                type="text"
                placeholder={currentUser ? (replyingTo ? "Viết phản hồi của thầy cô..." : "Viết bình luận công khai...") : "Đăng nhập để bình luận bài viết"}
                disabled={!currentUser || submittingComment}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-grow bg-white border border-slate-200 rounded-full px-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={submittingComment || !newComment.trim()}
                className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-full flex items-center justify-center transition-all shrink-0 shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Comment List */}
          {loadingComments ? (
            <div className="py-4 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-slate-400 text-xs py-2">Chưa có bình luận nào cho bài đăng này.</p>
          ) : (
            <div className="space-y-4">
              {comments.filter(c => !c.parentId).map((parent) => {
                const replies = comments.filter(c => c.parentId === parent.id);
                const canDeleteParent = currentUser && (
                  parent.userId === currentUser.uid || 
                  post.userId === currentUser.uid || 
                  userProfile?.package === 'admin'
                );
                return (
                  <div key={parent.id} className="space-y-2.5">
                    {/* Parent Comment */}
                    <div className="flex gap-2.5 items-start">
                      {parent.userAvatar ? (
                        <img 
                          src={parent.userAvatar} 
                          alt={parent.userName} 
                          className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5 hover:opacity-85 transition-opacity cursor-pointer border border-slate-150"
                          referrerPolicy="no-referrer"
                          onClick={() => onViewProfile(parent.userId, parent.userName, parent.userAvatar)}
                        />
                      ) : (
                        <div 
                          onClick={() => onViewProfile(parent.userId, parent.userName)}
                          className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0 border border-slate-300 mt-0.5 cursor-pointer transition-colors"
                        >
                          {parent.userName[0]?.toUpperCase() || "U"}
                        </div>
                      )}
                      <div className="flex-grow flex flex-col items-start gap-1">
                        <div className="bg-slate-100 rounded-2xl px-3.5 py-2.5 text-xs w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span 
                              onClick={() => onViewProfile(parent.userId, parent.userName, parent.userAvatar)}
                              className="font-bold text-slate-800 hover:text-blue-600 cursor-pointer transition-colors"
                            >
                              {parent.userName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">{formatTime(parent.createdAt)}</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed whitespace-pre-line">{parent.content}</p>
                        </div>
                        {/* Actions line */}
                        <div className="flex items-center gap-3 pl-2.5 text-[10px] text-slate-400 font-bold">
                          <button 
                            onClick={() => handleReplyClick(parent.id, parent.userName, parent.userId)}
                            className="hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Trả lời
                          </button>
                          {canDeleteParent && (
                            <button 
                              onClick={() => handleDeleteComment(parent.id)}
                              className="hover:text-red-600 text-slate-400 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Xóa
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Nested Replies */}
                    {replies.length > 0 && (
                      <div className="pl-10 space-y-2.5 border-l-2 border-slate-200/50 ml-4">
                        {replies.map((reply) => {
                          const canDeleteReply = currentUser && (
                            reply.userId === currentUser.uid || 
                            post.userId === currentUser.uid || 
                            userProfile?.package === 'admin'
                          );
                          return (
                            <div key={reply.id} className="flex gap-2 items-start relative">
                            {/* Visual link curve */}
                            <div className="absolute -left-[18px] top-4 w-4 h-0.5 bg-slate-200/50"></div>
                            
                            {reply.userAvatar ? (
                              <img 
                                src={reply.userAvatar} 
                                alt={reply.userName} 
                                className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5 hover:opacity-85 transition-opacity cursor-pointer border border-slate-150"
                                referrerPolicy="no-referrer"
                                onClick={() => onViewProfile(reply.userId, reply.userName, reply.userAvatar)}
                              />
                            ) : (
                              <div 
                                onClick={() => onViewProfile(reply.userId, reply.userName)}
                                className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0 border border-slate-300 mt-0.5 cursor-pointer transition-colors"
                              >
                                {reply.userName[0]?.toUpperCase() || "U"}
                              </div>
                            )}
                            <div className="flex-grow bg-slate-150 rounded-2xl px-3 py-2 text-xs">
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-1">
                                  <span 
                                    onClick={() => onViewProfile(reply.userId, reply.userName, reply.userAvatar)}
                                    className="font-bold text-slate-800 hover:text-blue-600 cursor-pointer transition-colors"
                                  >
                                    {reply.userName}
                                  </span>
                                  {reply.replyToName && (
                                    <span className="text-[10px] text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded-md font-semibold">
                                      phản hồi <b>@{reply.replyToName}</b>
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] text-slate-400 font-medium">{formatTime(reply.createdAt)}</span>
                                  <button 
                                    onClick={() => handleReplyClick(parent.id, reply.userName, reply.userId)}
                                    className="text-[10px] text-slate-400 hover:text-blue-600 font-bold transition-colors cursor-pointer"
                                  >
                                    Trả lời
                                  </button>
                                  {canDeleteReply && (
                                    <button 
                                      onClick={() => handleDeleteComment(reply.id)}
                                      className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                      title="Xóa phản hồi"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-slate-700 leading-relaxed whitespace-pre-line">{reply.content}</p>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </motion.div>
  );
}
