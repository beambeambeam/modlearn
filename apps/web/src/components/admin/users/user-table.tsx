import { useState } from "react";
import { Search, Shield, ShieldOff, Ban, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useUsers, useSetUserRole, useBanUser, useUnbanUser } from "@/hooks/users/use-users";
import { toast } from "sonner";
import { useRouteContext } from "@tanstack/react-router";

const PAGE_SIZE = 10;

export default function UserTable() {
  const { session } = useRouteContext({ from: "/_admin-layout" });
  const currentUserId = session.data?.user.id;
  const currentRole   = session.data?.user.role as string;
  
  const allowedRoles = currentRole === "superadmin"
    ? ["user", "admin", "superadmin"]
    : ["user"];

  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);

  const { data, isLoading, isError } = useUsers(page, search);
  const setRoleMutation  = useSetUserRole();
  const banMutation      = useBanUser();
  const unbanMutation    = useUnbanUser();

  const users      = data?.users ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

    const handleRoleChange = (userId: string, role: string) => {
        if (!["user", "admin", "superadmin"].includes(role)) return;
        setRoleMutation.mutate(
            { userId, role: role as "user" | "admin" | "superadmin" },
            {
            onSuccess: () => toast.success("Role updated"),
            onError:   () => toast.error("Failed to update role"),
            }
        );
    };

  const handleBan = (userId: string, isBanned: boolean) => {
    if (isBanned) {
      unbanMutation.mutate(
        { userId },
        {
          onSuccess: () => toast.success("User unbanned"),
          onError:   () => toast.error("Failed to unban user"),
        }
      );
    } else {
      banMutation.mutate(
        { userId },
        {
          onSuccess: () => toast.success("User banned"),
          onError:   () => toast.error("Failed to ban user"),
        }
      );
    }
  };

  if (isLoading) return (
    <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
      Loading users...
    </div>
  );

  if (isError) return (
    <div className="rounded-xl border bg-card p-12 text-center text-sm text-destructive">
      Failed to load users
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by email..."
          className="pl-9"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <div className="grid grid-cols-[2fr_120px_100px_120px_auto] gap-4 px-6 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>User</span>
          <span>Role</span>
          <span>Status</span>
          <span>Joined</span>
          <span></span>
        </div>

        {users.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No users found</div>
        ) : (
          users.map((user) => {
            const isSelf    = user.id === currentUserId;
            const isHigher  = user.role === "superadmin" && currentRole !== "superadmin";
            const canEdit   = !isSelf && !isHigher;
            const isBanned = !!user.banned;
            const role     = (user.role as string) ?? "user";

            return (
              <div
                key={user.id}
                className="grid grid-cols-[2fr_120px_100px_120px_auto] gap-4 items-center px-6 py-4 border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                {/* User info */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {user.name?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                {/* Role selector */}
                <Select
                  value={role}
                  disabled={!canEdit}
                  onValueChange={(v) => v && handleRoleChange(user.id, v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status */}
                {isBanned
                  ? <Badge className="bg-red-100 text-red-700 hover:bg-red-100 w-fit">Banned</Badge>
                  : <Badge className="bg-green-100 text-green-700 hover:bg-green-100 w-fit">Active</Badge>
                }

                {/* Joined */}
                <span className="text-xs text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>

                {/* Actions */}
                <Button
                  variant="ghost" size="icon"
                  className={isBanned
                    ? "text-green-600 hover:text-green-600 hover:bg-green-50"
                    : "text-destructive hover:text-destructive hover:bg-destructive/10"
                  }
                  disabled={banMutation.isPending || unbanMutation.isPending}
                  onClick={() => handleBan(user.id, isBanned)}
                  title={isBanned ? "Unban user" : "Ban user"}
                >
                  {isBanned ? <CheckCircle size={16} /> : <Ban size={16} />}
                </Button>
              </div>
            );
          })
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-3">
          <span className="text-xs text-muted-foreground">
            {total} users total
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              disabled={page === 1} onClick={() => setPage((p) => p - 1)}>{"<"}</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button key={p} variant={p === page ? "default" : "ghost"}
                size="icon" className="h-8 w-8 text-xs"
                onClick={() => setPage(p)}>{p}</Button>
            ))}
            <Button variant="ghost" size="icon" className="h-8 w-8"
              disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>{">"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}