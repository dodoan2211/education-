import { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";
import { useChat } from "../context/ChatContext";
import { db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  addDoc, 
  updateDoc, 
  writeBatch, 
  serverTimestamp, 
  onSnapshot 
} from "firebase/firestore";
import { 
  MessageSquare, 
  X, 
  Send, 
  Search, 
  ArrowLeft, 
  Users, 
  Sparkles, 
  ShieldCheck, 
  Mail, 
  Phone,
  MessageCircle,
  Clock,
  Image as ImageIcon,
  Smile,
  Trash2,
  Paperclip,
  MoreVertical,
  Reply
} from "lucide-react";
import { useToast } from "../context/ToastContext";

interface Conversation {
  id: string;
  participants: string[];
  participantNames: { [key: string]: string };
  participantAvatars?: { [key: string]: string };
  lastMessage: string;
  lastSenderId: string;
  updatedAt: any;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  text: string;
  imageUrl?: string;
  isRecalled?: boolean;
  reactions?: { [userId: string]: string };
  createdAt: any;
  read: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  workplace?: string;
  avatar?: string;
  package?: string;
  hideEmail?: boolean;
  hidePhone?: boolean;
}

export default function GlobalChat() {
  const { user, userProfile } = useAuth();
  const { isChatOpen, setIsChatOpen, activeUser, setActiveUser, openChatWithUser, unreadCount, lastUnreadMsg } = useChat();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'inbox' | 'directory'>('inbox');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const prevUnreadCount = useRef(unreadCount);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null); // messageId
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Notify user when new message arrives and chat is closed
  useEffect(() => {
    // Only notify if unread count actually increases and chat is closed
    if (unreadCount > prevUnreadCount.current && !isChatOpen && unreadCount > 0) {
      if (lastUnreadMsg) {
        toast.info(`${lastUnreadMsg.senderName}: ${lastUnreadMsg.text.substring(0, 50)}${lastUnreadMsg.text.length > 50 ? '...' : ''}`, 5000);
      } else {
        toast.info("Bạn có tin nhắn mới từ đồng nghiệp!", 5000);
      }
    }
    prevUnreadCount.current = unreadCount;
  }, [unreadCount, isChatOpen, lastUnreadMsg, toast]);

  // Helper to convert Firestore timestamp to millisecond number for sorting
  const getMs = (val: any) => {
    if (!val) return 0;
    if (val.seconds) return val.seconds * 1000;
    if (val.toDate) return val.toDate().getTime();
    return new Date(val).getTime() || 0;
  };

  // Scroll to bottom of message list
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Body scroll lock when chat is open
  useEffect(() => {
    if (isChatOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isChatOpen]);

  useEffect(() => {
    if (isChatOpen && activeUser) {
      scrollToBottom();
    }
  }, [messages, isChatOpen, activeUser]);

  // 1. Listen to user's active conversations
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Conversation[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Conversation);
      });
      // Sort descending by updatedAt in memory
      list.sort((a, b) => getMs(b.updatedAt) - getMs(a.updatedAt));
      setConversations(list);
    }, (err) => {
      console.error("Lỗi tải danh sách hội thoại:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Listen to messages for the active conversation
  useEffect(() => {
    if (!user || !activeUser) {
      setMessages([]);
      return;
    }

    const convId = user.uid < activeUser.id ? `${user.uid}_${activeUser.id}` : `${activeUser.id}_${user.uid}`;
    
    const q = query(
      collection(db, "messages"),
      where("conversationId", "==", convId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Message[] = [];
      const unreadIds: string[] = [];

      snapshot.forEach((docSnap) => {
        const msg = { id: docSnap.id, ...docSnap.data() } as Message;
        list.push(msg);

        // Track unread messages from the other user
        if (msg.senderId === activeUser.id && !msg.read) {
          unreadIds.push(msg.id);
        }
      });

      // Sort ascending in memory by createdAt
      list.sort((a, b) => getMs(a.createdAt) - getMs(b.createdAt));
      setMessages(list);

      // Mark unread messages as read only if the chat is actively being viewed
      if (isChatOpen && unreadIds.length > 0) {
        const batch = writeBatch(db);
        unreadIds.forEach((id) => {
          batch.update(doc(db, "messages", id), { read: true });
        });
        batch.commit().catch(e => console.error("Lỗi cập nhật trạng thái đã đọc:", e));
      }
    }, (err) => {
      console.error("Lỗi tải tin nhắn:", err);
    });

    return () => unsubscribe();
  }, [user, activeUser, isChatOpen]);

  // 3. Load directory of other colleagues/teachers
  const fetchDirectory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const querySnap = await getDocs(collection(db, "users"));
      const list: UserProfile[] = [];
      querySnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (docSnap.id !== user.uid) {
          list.push({
            id: docSnap.id,
            name: data.name || "Giáo viên",
            email: data.email || "",
            phone: data.phone || "",
            workplace: data.workplace || "Chưa cập nhật",
            avatar: data.avatar || "",
            package: data.package || "free",
            hideEmail: data.hideEmail || false,
            hidePhone: data.hidePhone || false
          });
        }
      });
      setUsersList(list);
    } catch (err) {
      console.error("Lỗi tải danh bạ đồng nghiệp:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isChatOpen && activeTab === 'directory') {
      fetchDirectory();
    }
  }, [isChatOpen, activeTab]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Vui lòng chọn ảnh nhỏ hơn 5MB.");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeUser || (!newMessage.trim() && !imageFile) || sending) return;

    setSending(true);
    const textToSend = newMessage.trim();
    setNewMessage("");

    const convId = user.uid < activeUser.id ? `${user.uid}_${activeUser.id}` : `${activeUser.id}_${user.uid}`;

    try {
      let imageUrl = "";
      if (imageFile) {
        const imageRef = ref(storage, `chat_images/${convId}/${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
        clearImage();
      }

      // Add message
      await addDoc(collection(db, "messages"), {
        conversationId: convId,
        senderId: user.uid,
        senderName: userProfile?.name || user.displayName || user.email?.split("@")[0] || "Giáo viên",
        senderAvatar: userProfile?.avatar || "",
        recipientId: activeUser.id,
        text: textToSend,
        imageUrl: imageUrl,
        isRecalled: false,
        reactions: {},
        createdAt: serverTimestamp(),
        read: false
      });

      // Update conversation summary
      const convRef = doc(db, "conversations", convId);
      await updateDoc(convRef, {
        lastMessage: imageUrl ? (textToSend ? `🖼️ ${textToSend}` : "🖼️ Hình ảnh") : textToSend,
        lastSenderId: user.uid,
        updatedAt: serverTimestamp(),
        // Ensure names/avatars are synced in direct map structure
        [`participantNames.${user.uid}`]: userProfile?.name || user.displayName || user.email?.split("@")[0] || "Giáo viên",
        [`participantNames.${activeUser.id}`]: activeUser.name,
        [`participantAvatars.${user.uid}`]: userProfile?.avatar || "",
        [`participantAvatars.${activeUser.id}`]: activeUser.avatar || ""
      });

    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
      toast.error("Không thể gửi tin nhắn.");
    } finally {
      setSending(false);
    }
  };

  const handleRecallMessage = async (msgId: string) => {
    try {
      await updateDoc(doc(db, "messages", msgId), {
        isRecalled: true
      });
    } catch (err) {
      console.error("Lỗi thu hồi tin nhắn:", err);
      toast.error("Không thể thu hồi tin nhắn.");
    }
  };

  const handleReactToMessage = async (msgId: string, emoji: string) => {
    if (!user) return;
    try {
      const msgRef = doc(db, "messages", msgId);
      const msg = messages.find(m => m.id === msgId);
      if (!msg) return;
      
      const newReactions = { ...msg.reactions };
      if (newReactions[user.uid] === emoji) {
        delete newReactions[user.uid]; // Toggle off
      } else {
        newReactions[user.uid] = emoji;
      }
      
      await updateDoc(msgRef, { reactions: newReactions });
      setShowEmojiPicker(null);
    } catch (err) {
      console.error("Lỗi thả cảm xúc:", err);
    }
  };

  const filteredUsers = usersList.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.workplace?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatMessageTime = (ts: any) => {
    if (!ts) return "";
    const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Chat Bubble */}
      {!isChatOpen && (
        <button 
          id="global-chat-bubble"
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-[9999] bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-full w-14 h-14 shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer group border-2 border-white/50 backdrop-blur-sm"
        >
          <div className="relative">
            <MessageCircle className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          
          {/* Tooltip */}
          <span className="absolute bottom-full right-0 mb-3 bg-slate-900 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none border border-slate-700">
            Trò chuyện
          </span>
        </button>
      )}

      {/* Slide-out Chat Panel */}
      {isChatOpen && (
        <div 
          id="global-chat-panel"
          className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-32px)] h-[600px] max-h-[calc(100vh-100px)] bg-white rounded-2xl shadow-2xl border border-slate-150 z-[9999] flex flex-col overflow-hidden animate-fade-in"
        >
          {/* Panel Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3.5 flex items-center justify-between shrink-0">
            {activeUser ? (
              <div className="flex items-center gap-2.5">
                <button 
                  onClick={() => setActiveUser(null)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-white"
                  title="Quay lại"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                {activeUser.avatar ? (
                  <img 
                    src={activeUser.avatar} 
                    alt={activeUser.name} 
                    className="w-8 h-8 rounded-full object-cover border border-white/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs uppercase border border-white/10">
                    {activeUser.name[0]}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-sm tracking-tight truncate max-w-[160px]">{activeUser.name}</h3>
                  <p className="text-[10px] text-blue-100">Đang trò chuyện trực tuyến</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                    Trò chuyện trực tiếp
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                  </h3>
                  <p className="text-[10px] text-blue-100">Kết nối & Chia sẻ với đồng nghiệp</p>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => setIsChatOpen(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-white"
              title="Đóng cửa sổ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Selection (only visible when not actively chatting) */}
          {!activeUser && (
            <div className="flex border-b border-slate-100 bg-slate-50 shrink-0">
              <button
                onClick={() => setActiveTab('inbox')}
                className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                  activeTab === 'inbox' 
                    ? 'border-blue-600 text-blue-600 bg-white' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Hộp thư
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('directory')}
                className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                  activeTab === 'directory' 
                    ? 'border-blue-600 text-blue-600 bg-white' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                Tìm đồng nghiệp
              </button>
            </div>
          )}

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto bg-slate-50/50">
            {activeUser ? (
              /* Active Chat messages list */
              <div className="p-4 space-y-3 min-h-full flex flex-col justify-end">
                {messages.length === 0 ? (
                  <div className="text-center py-12 flex-1 flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center border border-blue-100">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-slate-500 font-bold">Hãy bắt đầu gửi tin nhắn đầu tiên!</p>
                    <p className="text-[10px] text-slate-400">Tin nhắn của thầy cô sẽ được mã hóa và gửi real-time.</p>
                  </div>
                ) : (
                  <div className="space-y-4 flex-1">
                    {messages.map((msg) => {
                      const isMe = msg.senderId === user.uid;
                      const reactions = msg.reactions || {};
                      const reactionEntries = Object.entries(reactions);
                      const hasReactions = reactionEntries.length > 0;
                      
                      return (
                        <div 
                          key={msg.id} 
                          className={`flex items-start gap-2 group ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isMe && (
                            msg.senderAvatar ? (
                              <img 
                                src={msg.senderAvatar} 
                                alt={msg.senderName} 
                                className="w-7 h-7 rounded-full object-cover mt-0.5 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center mt-0.5 shrink-0 border border-slate-300">
                                {msg.senderName[0]?.toUpperCase()}
                              </div>
                            )
                          )}
                          
                          {/* Message Actions (Left for me, Right for other) */}
                          {isMe && !msg.isRecalled && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center mr-1">
                              <button 
                                onClick={() => handleRecallMessage(msg.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                title="Thu hồi tin nhắn"
                              >
                                <Reply className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'} relative`}>
                            {msg.isRecalled ? (
                              <div className="px-3 py-2 rounded-2xl text-xs italic text-slate-400 border border-slate-200 bg-slate-50/50">
                                Tin nhắn đã được thu hồi
                              </div>
                            ) : (
                              <div className={`rounded-2xl flex flex-col overflow-hidden shadow-sm ${
                                isMe 
                                  ? 'bg-blue-600 text-white rounded-tr-none' 
                                  : 'bg-white border border-slate-150 text-slate-800 rounded-tl-none'
                              }`}>
                                {msg.imageUrl && (
                                  <img 
                                    src={msg.imageUrl} 
                                    alt="Đính kèm" 
                                    className="max-w-full max-h-[200px] object-cover cursor-pointer"
                                    onClick={() => window.open(msg.imageUrl, "_blank")}
                                  />
                                )}
                                {msg.text && (
                                  <div className={`px-3 py-2 text-xs leading-relaxed break-words whitespace-pre-wrap ${msg.imageUrl ? 'border-t border-black/10' : ''}`}>
                                    {msg.text}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Reactions */}
                            {!msg.isRecalled && hasReactions && (
                              <div className={`absolute -bottom-3 flex items-center gap-0.5 bg-white shadow-sm border border-slate-200 rounded-full px-1.5 py-0.5 z-10 ${isMe ? 'left-2' : 'right-2'}`}>
                                {reactionEntries.map(([uid, emoji]) => (
                                  <span key={uid} className="text-[10px]" title={uid === user.uid ? "Bạn" : msg.senderName}>{emoji}</span>
                                ))}
                              </div>
                            )}

                            <span className={`text-[9px] text-slate-400 mt-1 flex items-center gap-1 font-medium ${hasReactions ? 'pt-2' : ''}`}>
                              <Clock className="w-2.5 h-2.5" />
                              {formatMessageTime(msg.createdAt)}
                            </span>
                          </div>

                          {/* Message Actions (Right for other) */}
                          {!isMe && !msg.isRecalled && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center ml-1 relative">
                              <button 
                                onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                                className="p-1.5 text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-full transition-colors"
                                title="Thả cảm xúc"
                              >
                                <Smile className="w-3.5 h-3.5" />
                              </button>
                              
                              {/* Emoji Picker Popup */}
                              {showEmojiPicker === msg.id && (
                                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-full px-2 py-1 flex items-center gap-1 z-50 animate-fade-in">
                                  {['❤️', '👍', '😂', '😮', '😢', '👏'].map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleReactToMessage(msg.id, emoji)}
                                      className="text-sm hover:scale-125 transition-transform p-1 cursor-pointer"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            ) : activeTab === 'inbox' ? (
              /* Conversation list */
              <div className="divide-y divide-slate-100 bg-white min-h-full">
                {conversations.length === 0 ? (
                  <div className="text-center py-20 flex flex-col items-center justify-center p-6 gap-2">
                    <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center border border-slate-100">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-slate-500 font-bold">Hộp thư trống</p>
                    <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed">
                      Chưa có hội thoại nào. Hãy chuyển sang tab "Tìm đồng nghiệp" để bắt đầu trò chuyện.
                    </p>
                  </div>
                ) : (
                  conversations.map((conv) => {
                    // Find the other participant's ID
                    const otherId = conv.participants.find(p => p !== user.uid) || "";
                    const otherName = conv.participantNames?.[otherId] || "Giáo viên";
                    const otherAvatar = conv.participantAvatars?.[otherId] || "";
                    
                    const isLastMsgMe = conv.lastSenderId === user.uid;
                    // Check if there are any messages from this user that are unread
                    const isUnread = !isLastMsgMe && conv.lastSenderId !== "system" && conversations.some(c => c.id === conv.id && c.lastSenderId === otherId);

                    return (
                      <div 
                        key={conv.id}
                        onClick={() => openChatWithUser(otherId, otherName, otherAvatar)}
                        className={`p-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                          isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : ''
                        }`}
                      >
                        {otherAvatar ? (
                          <img 
                            src={otherAvatar} 
                            alt={otherName} 
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0 uppercase">
                            {otherName[0]}
                          </div>
                        )}
                        <div className="flex-grow overflow-hidden">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold text-slate-800 text-xs truncate pr-2">{otherName}</span>
                            <span className="text-[9px] text-slate-400 font-medium">{formatMessageTime(conv.updatedAt)}</span>
                          </div>
                          <p className={`text-[11px] truncate ${isUnread ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                            {isLastMsgMe ? "Bạn: " : ""}{conv.lastMessage}
                          </p>
                        </div>
                        {isUnread && (
                          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shrink-0"></div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Directory list */
              <div className="p-4 space-y-4">
                {/* Search field */}
                <div className="relative shrink-0">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm giáo viên, nơi công tác..."
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-200 bg-white rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {loading ? (
                  <div className="text-center py-10 text-xs text-slate-400 font-medium">Đang tải danh sách...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400 font-medium">Không tìm thấy giáo viên nào.</div>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.map((item) => (
                      <div 
                        key={item.id}
                        className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-200 hover:shadow-md transition-all flex flex-col gap-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          {item.avatar ? (
                            <img 
                              src={item.avatar} 
                              alt={item.name} 
                              className="w-9 h-9 rounded-full object-cover border border-slate-100 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                              {item.name[0]}
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <h4 className="font-bold text-xs text-slate-800 tracking-tight flex items-center gap-1.5 truncate">
                              {item.name}
                              {item.package === 'admin' && (
                                <span className="px-1.5 py-0.5 bg-red-50 border border-red-100 text-red-600 rounded-full text-[8px] font-extrabold uppercase">
                                  Admin
                                </span>
                              )}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium truncate">{item.workplace || "Chưa cập nhật nơi công tác"}</p>
                          </div>
                        </div>

                        {/* Professional Contact Info considering user's Privacy Options */}
                        <div className="grid grid-cols-1 gap-1 border-t border-dashed border-slate-100 pt-2 text-[10px] text-slate-500">
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {item.hideEmail ? (
                              <span className="text-slate-400 italic">Đã ẩn (Bảo mật)</span>
                            ) : (
                              <span className="font-medium truncate">{item.email}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {item.hidePhone ? (
                              <span className="text-slate-400 italic">Đã ẩn (Bảo mật)</span>
                            ) : (
                              <span className="font-medium">{item.phone || "Chưa cập nhật"}</span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => openChatWithUser(item.id, item.name, item.avatar)}
                          className="w-full py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Nhắn tin ngay
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel Footer (only visible when actively chatting) */}
          {activeUser && (
            <form 
              onSubmit={handleSendMessage} 
              className="p-3.5 bg-white border-t border-slate-150 flex flex-col gap-2 shrink-0 relative"
            >
              {imagePreview && (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-sm border border-slate-200">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              
              <div className="flex gap-2 items-center w-full">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleImageChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Đính kèm ảnh"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Nhập tin nhắn..."
                  disabled={sending}
                  className="flex-grow bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="submit"
                  disabled={(!newMessage.trim() && !imageFile) || sending}
                  className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 text-white disabled:text-slate-400 rounded-full flex items-center justify-center shadow-md shadow-blue-100 transition-all shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
