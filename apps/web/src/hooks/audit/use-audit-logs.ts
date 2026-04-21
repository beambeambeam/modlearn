import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

type AuditEntityType = "CONTENT" | "PLAYLIST" | "PLAYLIST_EPISODE" | "CATEGORY" | "FILE";
type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "SET_PUBLISH_STATE" |
  "SET_AVAILABILITY" | "SET_CLASSIFICATION" | "ADD_EPISODE" |
  "REORDER_EPISODES" | "UPDATE_EPISODE" | "REMOVE_EPISODE";

export function useAuditLogs(
  page: number,
  entityType?: AuditEntityType,
  action?: AuditAction,
  from?: Date,
  to?: Date
) {
  return useQuery({
    ...orpc.adminAudit.list.queryOptions({
      input: { page, limit: 20, entityType, action, from, to },
    }),
    placeholderData: (prev) => prev,
  });
}