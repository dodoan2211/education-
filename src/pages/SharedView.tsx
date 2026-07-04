import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import Layout from "../components/Layout";
import ReactMarkdown from "react-markdown";
import { 
  Loader2, 
  MessageSquare, 
  Send, 
  User, 
  Calendar, 
  School,
  ArrowLeft,
  FileText,
  Clock,
  History,
  RotateCcw,
  Eye,
  X,
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  AtSign,
  Smile,
  Plus
} from "lucide-react";
import { db } from "../firebase";
import { useToast } from "../context/ToastContext";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  addDoc, 
  serverTimestamp, 
  orderBy,
  onSnapshot,
  doc,
  updateDoc
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { ResourceItem, ResourceNote, ResourceVersion, UserProfile } from "../types";

export default function SharedView() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  
  const [resource, setResource] = useState<ResourceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'content' | 'notes' | 'history'>('content');
  
  const [notes, setNotes] = useState<ResourceNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [sendingNote, setSendingNote] = useState(false);

  const [versions, setVersions] = useState<ResourceVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ResourceVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeReactionNote, setActiveReactionNote] = useState<string | null>(null);

  const EMOJIS = ["👍", "❤️", "👏", "😄", "💡", "😮"];

  const [colleagues, setColleagues] = useState<UserProfile[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [filteredColleagues, setFilteredColleagues] = useState<UserProfile[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);

  const statusConfig = {
    draft: { label: "Bản thảo", color: "bg-slate-100 text-slate-600 border-slate-200", icon: <FileEdit className="w-3 h-3" /> },
    in_review: { label: "Đang duyệt", color: "bg-amber-100 text-amber-600 border-amber-200", icon: <AlertCircle className="w-3 h-3" /> },
    finalized: { label: "Hoàn tất", color: "bg-emerald-100 text-emerald-600 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> }
  };

  useEffect(() => {
    if (!shareCode) return;
    
    async function fetchResource() {
      setLoading(true);
      try {
        const q = query(
          collection(db, "resources"), 
          where("shareCode", "==", shareCode),
          where("isShared", "==", true),
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          toast.error("Không tìm thấy giáo án hoặc mã chia sẻ đã hết hạn.");
          setResource(null);
        } else {
          const docData = querySnapshot.docs[0];
          setResource({ id: docData.id, ...docData.data() } as ResourceItem);
        }
      } catch (e) {
        console.error("Error fetching shared resource:", e);
        toast.error("Lỗi khi tải giáo án.");
      } finally {
        setLoading(false);
      }
    }
    
    fetchResource();
  }, [shareCode]);

  useEffect(() => {
    if (!resource?.id) return;
    
    const q = query(
      collection(db, "resource_notes"),
      where("resourceId", "==", resource.id),
      orderBy("createdAt", "asc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ResourceNote[];
      setNotes(notesList);
    });
    
    return () => unsubscribe();
  }, [resource?.id]);

  useEffect(() => {
    if (!resource?.id || activeTab !== 'history') return;
    
    setLoadingVersions(true);
    const q = query(
      collection(db, "resource_versions"),
      where("resourceId", "==", resource.id),
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const versionsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ResourceVersion[];
      setVersions(versionsList);
      setLoadingVersions(false);
    });
    
    return () => unsubscribe();
  }, [resource?.id, activeTab]);

  useEffect(() => {
    if (!userProfile?.workplace) return;

    const q = query(
      collection(db, "users"),
      where("workplace", "==", userProfile.workplace),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
        .filter(u => u.id !== user?.uid); // Don't mention self
      setColleagues(usersList);
    });

    return () => unsubscribe();
  }, [userProfile?.workplace, user?.uid]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    setNewNote(value);
    setCursorPosition(position);

    // Check for @ mention
    const textBeforeCursor = value.substring(0, position);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");

    if (lastAtSymbol !== -1) {
      const queryText = textBeforeCursor.substring(lastAtSymbol + 1);
      // Ensure no spaces between @ and cursor to trigger mention
      if (!queryText.includes(" ")) {
        setMentionQuery(queryText);
        setShowMentions(true);
        
        const filtered = colleagues.filter(c => 
          (c.name || "").toLowerCase().includes(queryText.toLowerCase()) ||
          (c.email || "").toLowerCase().includes(queryText.toLowerCase())
        );
        setFilteredColleagues(filtered);
        return;
      }
    }
    
    setShowMentions(false);
  };

  const insertMention = (colleague: UserProfile) => {
    const textBeforeAt = newNote.substring(0, newNote.lastIndexOf("@", cursorPosition - 1));
    const textAfterMention = newNote.substring(cursorPosition);
    const mentionName = colleague.name || colleague.email?.split('@')[0] || "User";
    
    const updatedNote = `${textBeforeAt}@${mentionName} ${textAfterMention}`;
    setNewNote(updatedNote);
    setShowMentions(false);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !resource || !newNote.trim()) return;
    
    if (resource.workplace && userProfile?.workplace && resource.workplace !== userProfile.workplace) {
      toast.warning("Lưu ý: Bạn đang góp ý cho giáo án của trường khác.");
    }
    
    setSendingNote(true);
    try {
      const noteDoc = await addDoc(collection(db, "resource_notes"), {
        resourceId: resource.id,
        userId: user.uid,
        userName: userProfile?.name || user.email?.split('@')[0] || "Người dùng",
        userAvatar: userProfile?.avatar || "",
        text: newNote.trim(),
        workplace: userProfile?.workplace || "",
        createdAt: serverTimestamp()
      });

      // Parse mentions and send notifications
      const mentionRegex = /@(\w+)/g;
      const mentionNames = newNote.match(mentionRegex);
      
      if (mentionNames) {
        // Find users corresponding to mentioned names
        // This is a bit naive as names aren't unique IDs, but works for colleagues
        const mentionedUsers = colleagues.filter(c => {
          const name = c.name || c.email?.split('@')[0] || "";
          return mentionNames.some(m => m.substring(1) === name);
        });

        // Send notifications
        for (const targetUser of mentionedUsers) {
          await addDoc(collection(db, "notifications"), {
            userId: targetUser.id,
            fromUserId: user.uid,
            fromUserName: userProfile?.name || user.email?.split('@')[0] || "Người dùng",
            type: "comment", // Using existing type for compatibility
            title: "Bạn được nhắc tên",
            message: `${userProfile?.name || "Một đồng nghiệp"} đã nhắc tên bạn trong giáo án "${resource.title}"`,
            resourceId: resource.id, // Custom field
            shareCode: shareCode,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }

      setNewNote("");
    } catch (e) {
      console.error("Error adding note:", e);
      toast.error("Không thể gửi góp ý. Vui lòng thử lại.");
    } finally {
      setSendingNote(false);
    }
  };

  const handleReaction = async (noteId: string, emoji: string) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để bày tỏ cảm xúc.");
      return;
    }

    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const currentReactions = note.reactions || {};
    const users = currentReactions[emoji] || [];
    
    let newUsers;
    if (users.includes(user.uid)) {
      newUsers = users.filter(uid => uid !== user.uid);
    } else {
      newUsers = [...users, user.uid];
    }

    try {
      const noteRef = doc(db, "resource_notes", noteId);
      await updateDoc(noteRef, {
        [`reactions.${emoji}`]: newUsers
      });
      setActiveReactionNote(null);
    } catch (e) {
      console.error("Error updating reaction:", e);
      toast.error("Lỗi khi cập nhật cảm xúc.");
    }
  };

  const handleRestore = async (version: ResourceVersion) => {
    if (!resource || !user) return;
    
    setRestoring(true);
    try {
      // 1. Update the main resource
      await updateDoc(doc(db, "resources", resource.id), {
        content: version.content,
        updatedAt: serverTimestamp()
      });

      // 2. Create a version record for the restore action itself
      await addDoc(collection(db, "resource_versions"), {
        resourceId: resource.id,
        userId: user.uid,
        userName: userProfile?.name || user.email?.split('@')[0] || "Đồng nghiệp",
        content: version.content,
        createdAt: serverTimestamp(),
        changeType: "restore"
      });

      setResource({ ...resource, content: version.content });
      setActiveTab('content');
      setSelectedVersion(null);
      toast.success("Đã khôi phục phiên bản thành công!");
    } catch (e) {
      console.error("Error restoring version:", e);
      toast.error("Lỗi khi khôi phục phiên bản.");
    } finally {
      setRestoring(false);
    }
  };

  const handleStatusChange = async (newStatus: "draft" | "in_review" | "finalized") => {
    if (!resource || !user || resource.userId !== user.uid) return;
    
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, "resources", resource.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      setResource({ ...resource, status: newStatus });
      setShowStatusMenu(false);
      toast.success(`Đã cập nhật trạng thái: ${statusConfig[newStatus].label}`);
      
      // Optionally add a note or version record for status change
      await addDoc(collection(db, "resource_versions"), {
        resourceId: resource.id,
        userId: user.uid,
        userName: userProfile?.name || user.email?.split('@')[0] || "Chủ sở hữu",
        content: resource.content,
        createdAt: serverTimestamp(),
        changeType: "edit" // Or add a new changeType if preferred
      });
      
    } catch (e) {
      console.error("Error updating status:", e);
      toast.error("Lỗi khi cập nhật trạng thái.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[600px] text-blue-600">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="font-medium">Đang tải giáo án chia sẻ...</p>
        </div>
      </Layout>
    );
  }

  if (!resource) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto mt-12 p-8 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
          <School className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Tài liệu không khả dụng</h2>
          <p className="text-slate-500 mb-6">Giáo án này không tồn tại hoặc đã bị ngừng chia sẻ bởi chủ sở hữu.</p>
          <Link to="/dashboard" className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Quay lại Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg text-white shrink-0">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{resource.title}</h1>
                
                {/* Status Badge */}
                <div className="relative">
                  <button 
                    onClick={() => user?.uid === resource.userId && setShowStatusMenu(!showStatusMenu)}
                    disabled={updatingStatus}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${statusConfig[resource.status || 'draft'].color} ${user?.uid === resource.userId ? 'hover:shadow-md cursor-pointer active:scale-95' : 'cursor-default'}`}
                  >
                    {statusConfig[resource.status || 'draft'].icon}
                    {statusConfig[resource.status || 'draft'].label}
                    {user?.uid === resource.userId && <ChevronDown className={`w-3 h-3 transition-transform ${showStatusMenu ? 'rotate-180' : ''}`} />}
                  </button>

                  {showStatusMenu && user?.uid === resource.userId && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)}></div>
                      <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 py-2 animate-scale-in origin-top-left">
                        {(Object.keys(statusConfig) as Array<keyof typeof statusConfig>).map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(status)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors hover:bg-slate-50 ${resource.status === status ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                          >
                            <div className={`p-1.5 rounded-lg ${statusConfig[status].color}`}>
                              {statusConfig[status].icon}
                            </div>
                            {statusConfig[status].label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  Mã chia sẻ: <span className="text-blue-600">{shareCode}</span>
                </div>
                {resource.workplace && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    <School className="w-3.5 h-3.5 text-emerald-500" />
                    Trường: <span className="text-emerald-600">{resource.workplace}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  {resource.createdAt?.toDate ? resource.createdAt.toDate().toLocaleDateString('vi-VN') : 'Mới đây'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 shrink-0 overflow-x-auto pb-1 md:pb-0">
            <button 
              onClick={() => setActiveTab('content')}
              className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'content' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              <FileText className="w-4 h-4" /> Nội dung
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 relative whitespace-nowrap ${activeTab === 'notes' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              <MessageSquare className="w-4 h-4" /> Góp ý
              {notes.length > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  {notes.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              <History className="w-4 h-4" /> Lịch sử
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden min-h-[500px]">
          {activeTab === 'content' ? (
            <div className="p-8 md:p-12 animate-fade-in">
              <div className="markdown-body prose max-w-none prose-slate prose-headings:font-black prose-a:text-blue-600 prose-sm sm:prose-base leading-relaxed">
                <ReactMarkdown>{resource.content}</ReactMarkdown>
              </div>
            </div>
          ) : activeTab === 'notes' ? (
            <div className="flex flex-col h-[600px] animate-fade-in">
              {/* Notes List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                {notes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-8">
                    <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-bold text-slate-500">Chưa có góp ý nào</p>
                    <p className="text-sm opacity-70 mt-1 max-w-xs">Hãy là người đầu tiên để lại phản hồi hoặc ý kiến chuyên môn cho giáo án này.</p>
                  </div>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="flex gap-4 animate-slide-up">
                      <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                        {note.userAvatar ? (
                          <img src={note.userAvatar} alt={note.userName} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-slate-900">{note.userName}</span>
                          {note.workplace && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-full border border-blue-100">
                              {note.workplace}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-auto font-medium">
                            <Calendar className="w-3 h-3" />
                            {note.createdAt?.toDate ? note.createdAt.toDate().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Đang gửi...'}
                          </span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm text-slate-700 text-sm leading-relaxed mb-2">
                          {note.text.split(/(@\w+)/g).map((part, i) => 
                            part.startsWith("@") ? (
                              <span key={i} className="text-blue-600 font-bold">{part}</span>
                            ) : part
                          )}
                        </div>

                        {/* Reactions Area */}
                        <div className="flex flex-wrap items-center gap-2">
                          {note.reactions && Object.entries(note.reactions).map(([emoji, users]) => (
                            users.length > 0 && (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(note.id, emoji)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-all ${
                                  users.includes(user?.uid || "") 
                                    ? "bg-blue-50 border-blue-200 text-blue-600" 
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="font-bold">{users.length}</span>
                              </button>
                            )
                          ))}
                          
                          {user && (
                            <div className="relative">
                              <button 
                                onClick={() => setActiveReactionNote(activeReactionNote === note.id ? null : note.id)}
                                className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-all border border-slate-200"
                                title="Thêm cảm xúc"
                              >
                                <Smile className="w-4 h-4" />
                              </button>

                              {activeReactionNote === note.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setActiveReactionNote(null)}></div>
                                  <div className="absolute bottom-full left-0 mb-2 p-1.5 bg-white rounded-full shadow-xl border border-slate-100 z-20 flex gap-1 animate-scale-in origin-bottom-left">
                                    {EMOJIS.map(emoji => (
                                      <button
                                        key={emoji}
                                        onClick={() => handleReaction(note.id, emoji)}
                                        className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full transition-colors text-lg"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Note Input */}
              <div className="p-6 bg-white border-t border-slate-200">
                {!user ? (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center">
                    <p className="text-sm font-bold text-amber-900">Vui lòng đăng nhập để gửi góp ý</p>
                    <Link to="/login" className="text-xs text-blue-600 font-bold hover:underline mt-1 inline-block">Đăng nhập ngay</Link>
                  </div>
                ) : (
                  <form onSubmit={handleAddNote} className="relative group">
                    {showMentions && filteredColleagues.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-20 animate-slide-up">
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <AtSign className="w-3 h-3" /> Nhắc tên đồng nghiệp
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredColleagues.map((colleague) => (
                            <button
                              key={colleague.id}
                              type="button"
                              onClick={() => insertMention(colleague)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left group"
                            >
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                                {colleague.avatar ? (
                                  <img src={colleague.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{colleague.name || colleague.email?.split('@')[0]}</p>
                                <p className="text-[10px] text-slate-500 truncate">{colleague.email}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <textarea 
                      value={newNote}
                      onChange={handleTextChange}
                      placeholder="Viết phản hồi hoặc ý kiến chuyên môn của thầy cô... (Sử dụng @ để nhắc tên)"
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-0 focus:outline-none transition-all resize-none text-sm pr-16 group-hover:bg-white"
                      rows={3}
                    />
                    <button 
                      type="submit"
                      disabled={!newNote.trim() || sendingNote}
                      className="absolute bottom-4 right-4 bg-blue-600 text-white p-3 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
                    >
                      {sendingNote ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 h-[600px] overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Lịch sử thay đổi
                </h3>
                <p className="text-xs text-slate-500 italic">Hiển thị các phiên bản đã được lưu của giáo án này.</p>
              </div>

              {loadingVersions ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-80 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <History className="w-12 h-12 text-slate-300 mb-4" />
                  <p className="font-bold text-slate-500">Chưa có lịch sử thay đổi</p>
                  <p className="text-sm text-slate-400 mt-1">Các phiên bản sẽ tự động được lưu khi có người chỉnh sửa.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {versions.map((version) => (
                    <div 
                      key={version.id} 
                      className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${version.changeType === 'restore' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                          {version.changeType === 'restore' ? <RotateCcw className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{version.userName}</span>
                            {version.changeType === 'restore' && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-black uppercase rounded-full border border-amber-100">Khôi phục</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {version.createdAt?.toDate ? version.createdAt.toDate().toLocaleString('vi-VN') : 'Đang lưu...'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setSelectedVersion(version)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Xem phiên bản này"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {user?.uid && resource.userId === user.uid && (
                          <button 
                            onClick={() => handleRestore(version)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Khôi phục phiên bản này"
                          >
                            <RotateCcw className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Version Preview Modal */}
      {selectedVersion && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200 animate-scale-in flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                  <Eye className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 leading-none">Xem lại phiên bản</h3>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">Lưu bởi {selectedVersion.userName} lúc {selectedVersion.createdAt?.toDate ? selectedVersion.createdAt.toDate().toLocaleString('vi-VN') : ''}</p>
                </div>
              </div>
              <button onClick={() => setSelectedVersion(null)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 mb-8">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-medium">Thầy cô đang xem trước một phiên bản cũ. Nội dung này không tự động cập nhật vào giáo án hiện tại trừ khi thầy cô chọn khôi phục.</p>
              </div>
              <div className="markdown-body prose max-w-none prose-slate prose-headings:font-black prose-a:text-blue-600 prose-sm sm:prose-base leading-relaxed">
                <ReactMarkdown>{selectedVersion.content}</ReactMarkdown>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <button 
                onClick={() => setSelectedVersion(null)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
              >
                Đóng lại
              </button>
              {user?.uid && resource.userId === user.uid && (
                <button 
                  onClick={() => handleRestore(selectedVersion)}
                  disabled={restoring}
                  className="flex-[2] py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {restoring ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                  {restoring ? "Đang khôi phục..." : "Khôi phục phiên bản này"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
