'use client';
import { useEffect, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';

export type PresenceStatus = 'online' | 'away' | 'dnd';

export interface UserPresence {
  status: PresenceStatus;
  statusText?: string | null;
}

export interface UsePresenceResult {
  onlineUserIds: Set<number>;
  statuses: Map<number, UserPresence>;
  setMyStatus: (status: PresenceStatus, statusText?: string) => void;
  isOnline: (userId: number) => boolean;
}

/**
 * React hook that listens to presence events and keeps a local map of online status.
 *
 * Assumes the socket has its auth token set and is connected.
 */
export function usePresence(socket: Socket | null): UsePresenceResult {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const [statuses, setStatuses] = useState<Map<number, UserPresence>>(new Map());

  useEffect(() => {
    if (!socket) return;

    const onOnlineUsers = (ids: number[]) => {
      setOnlineUserIds(new Set(ids));
    };
    const onUserOnline = ({ userId }: { userId: number }) => {
      setOnlineUserIds(prev => new Set(prev).add(userId));
    };
    const onUserOffline = ({ userId }: { userId: number }) => {
      setOnlineUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };
    const onStatusChanged = ({ userId, status, statusText }: { userId: number; status: PresenceStatus; statusText: string | null }) => {
      setStatuses(prev => {
        const next = new Map(prev);
        next.set(userId, { status, statusText });
        return next;
      });
    };

    socket.on('online-users', onOnlineUsers);
    socket.on('user-online', onUserOnline);
    socket.on('user-offline', onUserOffline);
    socket.on('user-status-changed', onStatusChanged);

    return () => {
      socket.off('online-users', onOnlineUsers);
      socket.off('user-online', onUserOnline);
      socket.off('user-offline', onUserOffline);
      socket.off('user-status-changed', onStatusChanged);
    };
  }, [socket]);

  const setMyStatus = useCallback((status: PresenceStatus, statusText?: string) => {
    socket?.emit('set-status', { status, statusText });
  }, [socket]);

  const isOnline = useCallback((userId: number) => onlineUserIds.has(userId), [onlineUserIds]);

  return { onlineUserIds, statuses, setMyStatus, isOnline };
}
