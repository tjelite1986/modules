'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import type { Message, TypingUser, SendMessagePayload } from '@/lib/chat-types';

export interface UseChatOptions {
  channelId: number | null;
  /** Auto-fetch existing messages from REST API when channelId changes */
  autoFetch?: boolean;
  /** Override default fetch URL pattern */
  fetchUrl?: (channelId: number) => string;
}

export interface UseChatResult {
  messages: Message[];
  typingUsers: TypingUser[];
  loading: boolean;
  sendMessage: (payload: Omit<SendMessagePayload, 'channelId'>) => void;
  startTyping: () => void;
  stopTyping: () => void;
  addReaction: (messageId: number, emoji: string) => void;
  removeReaction: (messageId: number, emoji: string) => void;
  editMessage: (messageId: number, content: string) => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
}

/**
 * React hook that manages realtime chat for a channel.
 * Assumes the socket is connected with a JWT token in auth.
 */
export function useChat(socket: Socket | null, options: UseChatOptions): UseChatResult {
  const { channelId, autoFetch = true, fetchUrl } = options;
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // Fetch existing messages on channel change
  useEffect(() => {
    if (!channelId || !autoFetch) return;
    const url = fetchUrl ? fetchUrl(channelId) : `/api/channels/${channelId}/messages`;
    setLoading(true);
    fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then((msgs: Message[]) => {
        setMessages(Array.isArray(msgs) ? msgs : []);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [channelId, autoFetch, fetchUrl]);

  // Subscribe to socket events
  useEffect(() => {
    if (!socket || !channelId) return;

    socket.emit('join-channel', channelId);

    const onNewMessage = (msg: Message) => {
      if (msg.channelId !== channelId) return;
      setMessages(prev => [...prev, msg]);
    };
    const onTyping = (data: TypingUser) => {
      if (data.channelId !== channelId) return;
      setTypingUsers(prev => prev.find(u => u.userId === data.userId) ? prev : [...prev, data]);
    };
    const onStoppedTyping = ({ userId }: { userId: number; channelId: number }) => {
      setTypingUsers(prev => prev.filter(u => u.userId !== userId));
    };
    const onReactionUpdate = ({ messageId, reactions }: { messageId: number; reactions: Record<string, string[]> }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    };
    const onMessageEdited = ({ messageId, content, editedAt, channelId: cid }: { messageId: number; content: string; editedAt: string; channelId: number }) => {
      if (cid !== channelId) return;
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, editedAt } : m));
    };
    const onMessageDeleted = ({ messageId, channelId: cid }: { messageId: number; channelId: number }) => {
      if (cid !== channelId) return;
      setMessages(prev => prev.filter(m => m.id !== messageId));
    };

    socket.on('new-message', onNewMessage);
    socket.on('typing', onTyping);
    socket.on('stopped-typing', onStoppedTyping);
    socket.on('reaction-update', onReactionUpdate);
    socket.on('message-edited', onMessageEdited);
    socket.on('message-deleted', onMessageDeleted);

    return () => {
      socket.emit('leave-channel', channelId);
      socket.off('new-message', onNewMessage);
      socket.off('typing', onTyping);
      socket.off('stopped-typing', onStoppedTyping);
      socket.off('reaction-update', onReactionUpdate);
      socket.off('message-edited', onMessageEdited);
      socket.off('message-deleted', onMessageDeleted);
      setTypingUsers([]);
    };
  }, [socket, channelId]);

  const sendMessage = useCallback((payload: Omit<SendMessagePayload, 'channelId'>) => {
    if (!socket || !channelId) return;
    socket.emit('send-message', { channelId, ...payload });
  }, [socket, channelId]);

  const startTyping = useCallback(() => {
    if (!socket || !channelId) return;
    socket.emit('typing-start', channelId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing-stop', channelId);
    }, 3000);
  }, [socket, channelId]);

  const stopTyping = useCallback(() => {
    if (!socket || !channelId) return;
    socket.emit('typing-stop', channelId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [socket, channelId]);

  const addReaction = useCallback((messageId: number, emoji: string) => {
    socket?.emit('add-reaction', { messageId, emoji });
  }, [socket]);

  const removeReaction = useCallback((messageId: number, emoji: string) => {
    socket?.emit('remove-reaction', { messageId, emoji });
  }, [socket]);

  const editMessage = useCallback(async (messageId: number, content: string) => {
    await fetch(`/api/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ content }),
    });
  }, []);

  const deleteMessage = useCallback(async (messageId: number) => {
    await fetch(`/api/messages/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  }, []);

  return { messages, typingUsers, loading, sendMessage, startTyping, stopTyping, addReaction, removeReaction, editMessage, deleteMessage };
}
