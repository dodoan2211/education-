export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  workplace?: string;
  package?: string;
  expiresAt?: string | null;
  usageCount?: number;
  avatar?: string;
  coins?: number;
  geminiApiKey?: string;
}

export interface ResourceItem {
  id: string;
  userId: string;
  title: string;
  type: "lesson_plan" | "plan" | "digital" | "video";
  content: string;
  createdAt: any;
  shareCode?: string;
  isShared?: boolean;
  workplace?: string;
  status?: "draft" | "in_review" | "finalized";
}

export interface ResourceVersion {
  id: string;
  resourceId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: any;
  changeType?: "edit" | "restore";
}

export interface ResourceNote {
  id: string;
  resourceId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: any;
  workplace?: string;
  reactions?: Record<string, string[]>;
}

export interface Competition {
  id: string;
  title: string;
  description: string;
  startDate: number;
  endDate: number;
}

export interface ConsignmentItem {
  id: string;
  userId: string;
  teacherName: string;
  title: string;
  description: string;
  content?: string;
  type: string;
  price: number;
  createdAt: any;
  fileUrl?: string;
  fileName?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: "expiry" | "consignment_purchase" | "general" | "like" | "comment" | "reply";
  title: string;
  message: string;
  createdAt: any;
  read: boolean;
  fromUserId?: string;
  fromUserName?: string;
  postId?: string;
  commentId?: string;
  amount?: number;
  docName?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  amount: number;
  type: 'deposit' | 'purchase' | 'earning' | 'package';
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  paymentInfo?: string;
  imageUrl?: string;
  itemId?: string;
  itemTitle?: string;
  sellerId?: string;
  packageKey?: string;
  packageLabel?: string;
  days?: number;
  createdAt: any;
  processedAt?: any;
}
