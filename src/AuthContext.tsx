import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { checkIsAdmin } from "./lib/permissions";
import { UserProfile } from "./types";

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, userProfile: null, isAdmin: false, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Listen to user profile changes
        unsubscribeSnapshot = onSnapshot(
          doc(db, "users", firebaseUser.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              let currentPackage = data.package || "free";
              let expiresAt = data.expiresAt || null;
              
              // Client-side expiry check (for real-time update)
              if (expiresAt && new Date(expiresAt) < new Date()) {
                currentPackage = "free";
              }
              
              const profileData = {
                id: docSnap.id,
                ...data,
                package: currentPackage,
                expiresAt: expiresAt,
                usageCount: data.usageCount || 0,
                geminiApiKey: data.geminiApiKey || ""
              };
              setUserProfile(profileData);
              setIsAdmin(checkIsAdmin(firebaseUser as any, profileData));
            } else {
              setUserProfile(null);
              setIsAdmin(checkIsAdmin(firebaseUser as any, null));
            }
            setLoading(false);
          },
          (error) => {
            console.error("Lỗi lắng nghe thay đổi hồ sơ người dùng:", error);
            setLoading(false);
          }
        );
      } else {
        setUserProfile(null);
        setIsAdmin(false);
        setLoading(false);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
