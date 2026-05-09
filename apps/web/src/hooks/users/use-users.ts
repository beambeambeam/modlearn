import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export const userKeys = {
  lists: () => ["users", "list"] as const,
  list:  (page: number, search: string) => ["users", "list", page, search] as const,
};

export function useUsers(page: number, search: string) {
  return useQuery({
    queryKey: userKeys.list(page, search),
    queryFn: async () => {
      const result = await authClient.admin.listUsers({
        query: {
          limit:  10,
          offset: (page - 1) * 10,
          searchField: search ? "email" : undefined,
          searchValue: search || undefined,
          sortBy: "createdAt",
          sortDirection: "desc",
        },
      });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    placeholderData: (prev) => prev,
  });
}

type UserRole = "user" | "admin" | "superadmin";

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const result = await authClient.admin.setRole({ userId, role });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

export function useBanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const result = await authClient.admin.banUser({ userId, banReason: reason });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

export function useUnbanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const result = await authClient.admin.unbanUser({ userId });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}