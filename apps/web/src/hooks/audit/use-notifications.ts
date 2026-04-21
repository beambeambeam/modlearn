import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { useEffect, useRef, useState } from "react";

const POLL_INTERVAL = 30_000; // 30 sec

export function useNotifications() {
  const STORAGE_KEY = "admin_last_seen_notification_id";

  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen]           = useState(false);
  const lastSeenId = useRef<string | null>(
    localStorage.getItem(STORAGE_KEY)
  );

  const { data, isLoading } = useQuery({
    ...orpc.adminAudit.list.queryOptions({
      input: { page: 1, limit: 10 },
    }),
    refetchInterval: POLL_INTERVAL,   // poll every 30s
    refetchIntervalInBackground: true,
  });

  const logs = data?.items ?? [];

  useEffect(() => {
    if (!logs.length) return;
    if (!lastSeenId.current) {
      setUnreadCount(logs.length);
      return;
    }
    const lastSeenIndex = logs.findIndex((l) => l.id === lastSeenId.current);
    if (lastSeenIndex === -1) {
      setUnreadCount(10);
    } else {
      setUnreadCount(lastSeenIndex);
    }
  }, [logs]);

  const handleOpen = () => {
    setIsOpen(true);
    if (logs.length > 0) {
      lastSeenId.current = logs[0].id;
      localStorage.setItem(STORAGE_KEY, logs[0].id);
      setUnreadCount(0);
    }
  };

  const handleClose = () => setIsOpen(false);

  return { logs, isLoading, unreadCount, isOpen, handleOpen, handleClose };
}