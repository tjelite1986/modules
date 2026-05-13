export interface Message {
  id: number;
  channelId: number;
  userId: number;
  username: string;
  avatar?: string;
  content: string;
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: number;
  replyToContent?: string;
  replyToUsername?: string;
  expiresAt?: string;
  editedAt?: string;
  createdAt: string;
  reactions: Record<string, string[]>;
}

export interface TypingUser {
  userId: number;
  username: string;
  channelId: number;
}

export interface SendMessagePayload {
  channelId: number;
  content?: string;
  replyTo?: number;
  expiresIn?: number;
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
  fileSize?: number;
}
