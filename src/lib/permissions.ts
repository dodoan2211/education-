import { User } from "firebase/auth";
import { UserProfile } from "../types";

export const ADMIN_EMAILS = ["dodoan2211@gmail.com"];

export const checkIsAdmin = (user: User | null, userProfile: UserProfile | null): boolean => {
  if (!user) return false;
  
  // Check by email (primary/hardcoded admin)
  if (user.email && ADMIN_EMAILS.includes(user.email)) {
    return true;
  }
  
  // Check by profile package status
  if (userProfile?.package === 'admin') {
    return true;
  }
  
  return false;
};
