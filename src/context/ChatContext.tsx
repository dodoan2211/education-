import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, onSnapshot } from "firebase/firestore";

interface ActiveChatUser {
  id: string;
  name: string;
  avatar?: string;
}

interface ChatContextType {
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  activeUser: ActiveChatUser | null;
  setActiveUser: (user: ActiveChatUser | null) => void;
  openChatWithUser: (userId: string, userName: string, userAvatar?: string) => void;
  unreadCount: number;
  lastUnreadMsg: { senderName: string; text: string } | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<ActiveChatUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastUnreadMsg, setLastUnreadMsg] = useState<{senderName: string, text: string} | null>(null);

  // Unread messages count for this user
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setLastUnreadMsg(null);
      return;
    }

    const q = query(
      collection(db, "messages"),
      where("recipientId", "==", user.uid),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
      
      if (!snapshot.empty) {
        // Find the most recent one
        const docs = snapshot.docs.map(d => d.data());
        docs.sort((a: any, b: any) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
        const latest = docs[0];
        setLastUnreadMsg({
          senderName: latest.senderName || "Đồng nghiệp",
          text: latest.text || "Đã gửi một tin nhắn"
        });
      } else {
        setLastUnreadMsg(null);
      }
    }, (err) => {
      console.error("Lỗi đếm tin nhắn chưa đọc:", err);
    });

    return () => unsubscribe();
  }, [user]);

  const openChatWithUser = async (targetId: string, targetName: string, targetAvatar?: string) => {
    if (!user) return;
    if (targetId === user.uid) return; // Cannot chat with oneself

    setIsChatOpen(true);
    setActiveUser({
      id: targetId,
      name: targetName,
      avatar: targetAvatar
    });

    // Generate unique conversation ID
    const convId = user.uid < targetId ? `${user.uid}_${targetId}` : `${targetId}_${user.uid}`;
    const convRef = doc(db, "conversations", convId);

    try {
      const snap = await getDoc(convRef);
      if (!snap.exists()) {
        await setDoc(convRef, {
          participants: [user.uid, targetId],
          participantNames: {
            [user.uid]: userProfile?.name || user.displayName || user.email?.split("@")[0] || "Giáo viên",
            [targetId]: targetName
          },
          participantAvatars: {
            [user.uid]: userProfile?.avatar || "",
            [targetId]: targetAvatar || ""
          },
          lastMessage: "Bắt đầu cuộc trò chuyện...",
          lastSenderId: "system",
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Lỗi tạo cuộc hội thoại:", err);
    }
  };

  return (
    <ChatContext.Provider value={{
      isChatOpen,
      setIsChatOpen,
      activeUser,
      setActiveUser,
      openChatWithUser,
      unreadCount,
      lastUnreadMsg
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
