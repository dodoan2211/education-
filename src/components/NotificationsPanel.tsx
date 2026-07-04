import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { Bell, User, Settings, Heart, MessageSquare, Reply, UserPlus, Info, Check, Trash2, Clock, ExternalLink, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";

interface Notification {
  id: string;
  userId: string;
  fromUserId?: string;
  fromUserName?: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
  postId?: string;
  commentId?: string;
  resourceId?: string;
  shareCode?: string;
}

export default function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"user" | "system">("user");

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Notification[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as Notification);
      });
      
      // Sort client-side to avoid composite index requirement (userId + createdAt)
      items.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setNotifications(items);
      setLoading(false);
    }, (error) => {
      console.error("Lỗi nghe thông báo:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        read: true
      });
    } catch (error) {
      console.error("Lỗi khi đánh dấu đã đọc:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, "notifications", n.id), { read: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Lỗi khi đánh dấu tất cả đã đọc:", error);
    }
  };

  const handleNotificationClick = (n: Notification) => {
    markAsRead(n.id);
    onClose();

    if (n.shareCode) {
      navigate(`/shared/${n.shareCode}`);
    } else if (n.postId) {
      // Navigate to community feed with post highlight (CommunityFeed is on Landing page "/")
      navigate(`/?post=${n.postId}`);
    } else if (n.type === "system" || n.type === "general") {
      // System notification might link to profile or transactions
      if (n.title.toLowerCase().includes("coin")) {
        navigate("/profile");
      }
    }
  };

  const userTypes = ["like", "love", "comment", "reply", "follow", "general"]; // Follow is general right now in code
  
  // Refined check: System notifications are usually from Admin or automated billing
  const userNotifications = notifications.filter(n => 
    ["like", "love", "comment", "reply", "follow"].includes(n.type) || 
    (n.type === "general" && n.fromUserId)
  );
  
  const systemNotifications = notifications.filter(n => 
    !["like", "love", "comment", "reply", "follow"].includes(n.type) && 
    !(n.type === "general" && n.fromUserId)
  );

  const displayedNotifications = activeTab === "user" ? userNotifications : systemNotifications;

  const getIcon = (type: string) => {
    switch (type) {
      case "like":
      case "love":
        return <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
      case "comment":
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case "reply":
        return <Reply className="w-4 h-4 text-indigo-500" />;
      case "follow":
        return <UserPlus className="w-4 h-4 text-emerald-500" />;
      case "system":
        return <Settings className="w-4 h-4 text-amber-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatTime = (createdAt: any) => {
    if (!createdAt) return "Vừa xong";
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "Vừa xong";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-600" />
          Thông báo
        </h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={markAllAsRead}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md transition-colors"
          >
            Đọc tất cả
          </button>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 pt-2 shrink-0">
        <button 
          onClick={() => setActiveTab("user")}
          className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === "user" 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Người dùng
          {userNotifications.filter(n => !n.read).length > 0 && (
            <span className="ml-1.5 bg-blue-100 text-blue-600 px-1 rounded-full text-[9px]">
              {userNotifications.filter(n => !n.read).length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab("system")}
          className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === "system" 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Hệ thống
          {systemNotifications.filter(n => !n.read).length > 0 && (
            <span className="ml-1.5 bg-amber-100 text-amber-600 px-1 rounded-full text-[9px]">
              {systemNotifications.filter(n => !n.read).length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500/50" />
            <p className="text-xs text-slate-400 font-medium">Đang tải thông báo...</p>
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400">Không có thông báo mới</p>
            <p className="text-[11px] text-slate-400 mt-1">Khi có cập nhật mới chúng tôi sẽ thông báo cho thầy cô tại đây.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {displayedNotifications.map((n) => (
              <div 
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 hover:bg-slate-50 transition-all cursor-pointer relative group ${!n.read ? 'bg-blue-50/30' : ''}`}
              >
                {!n.read && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                )}
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-slate-100 shadow-sm ${!n.read ? 'bg-white' : 'bg-slate-50'}`}>
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h4 className={`text-xs truncate pr-4 ${!n.read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                      {n.message}
                    </p>
                    {n.postId && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded">
                        <ExternalLink className="w-3 h-3" />
                        Xem chi tiết bài viết
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
