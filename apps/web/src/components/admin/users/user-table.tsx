import { useRouteContext } from "@tanstack/react-router";
import { Ban, CheckCircle, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	useBanUser,
	useSetUserRole,
	useUnbanUser,
	useUsers,
} from "@/hooks/users/use-users";

const PAGE_SIZE = 10;

export default function UserTable() {
	const { session } = useRouteContext({ from: "/_admin-layout" });
	const currentUserId = session.data?.user.id;
	const currentRole = session.data?.user.role as string;

	const allowedRoles =
		currentRole === "superadmin" ? ["user", "admin", "superadmin"] : ["user"];

	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);

	const { data, isLoading, isError } = useUsers(page, search);
	const setRoleMutation = useSetUserRole();
	const banMutation = useBanUser();
	const unbanMutation = useUnbanUser();

	const users = data?.users ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.ceil(total / PAGE_SIZE);

	const handleRoleChange = (userId: string, role: string) => {
		if (!["user", "admin", "superadmin"].includes(role)) {
			return;
		}
		setRoleMutation.mutate(
			{ userId, role: role as "user" | "admin" | "superadmin" },
			{
				onSuccess: () => toast.success("Role updated"),
				onError: () => toast.error("Failed to update role"),
			}
		);
	};

	const handleBan = (userId: string, isBanned: boolean) => {
		if (isBanned) {
			unbanMutation.mutate(
				{ userId },
				{
					onSuccess: () => toast.success("User unbanned"),
					onError: () => toast.error("Failed to unban user"),
				}
			);
		} else {
			banMutation.mutate(
				{ userId },
				{
					onSuccess: () => toast.success("User banned"),
					onError: () => toast.error("Failed to ban user"),
				}
			);
		}
	};

	if (isLoading) {
		return (
			<div className="rounded-xl border bg-card p-12 text-center text-muted-foreground text-sm">
				Loading users...
			</div>
		);
	}

	if (isError) {
		return (
			<div className="rounded-xl border bg-card p-12 text-center text-destructive text-sm">
				Failed to load users
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Search */}
			<div className="relative max-w-sm">
				<Search
					className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
					size={16}
				/>
				<Input
					className="pl-9"
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
					placeholder="Search by email..."
					value={search}
				/>
			</div>

			{/* Table */}
			<div className="rounded-xl border bg-card">
				<div className="grid grid-cols-[2fr_120px_100px_120px_auto] gap-4 border-b px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					<span>User</span>
					<span>Role</span>
					<span>Status</span>
					<span>Joined</span>
					<span />
				</div>

				{users.length === 0 ? (
					<div className="py-16 text-center text-muted-foreground text-sm">
						No users found
					</div>
				) : (
					users.map((user) => {
						const isSelf = user.id === currentUserId;
						const isHigher =
							user.role === "superadmin" && currentRole !== "superadmin";
						const canEdit = !(isSelf || isHigher);
						const isBanned = !!user.banned;
						const role = (user.role as string) ?? "user";

						return (
							<div
								className="grid grid-cols-[2fr_120px_100px_120px_auto] items-center gap-4 border-b px-6 py-4 transition-colors last:border-0 hover:bg-muted/30"
								key={user.id}
							>
								{/* User info */}
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-sm">
										{user.name?.charAt(0).toUpperCase() ?? "?"}
									</div>
									<div>
										<p className="font-medium text-sm">{user.name}</p>
										<p className="text-muted-foreground text-xs">
											{user.email}
										</p>
									</div>
								</div>

								{/* Role selector */}
								<Select
									disabled={!canEdit}
									onValueChange={(v) => v && handleRoleChange(user.id, v)}
									value={role}
								>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{allowedRoles.map((r) => (
											<SelectItem key={r} value={r}>
												{r}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								{/* Status */}
								{isBanned ? (
									<Badge className="w-fit bg-red-100 text-red-700 hover:bg-red-100">
										Banned
									</Badge>
								) : (
									<Badge className="w-fit bg-green-100 text-green-700 hover:bg-green-100">
										Active
									</Badge>
								)}

								{/* Joined */}
								<span className="text-muted-foreground text-xs">
									{new Date(user.createdAt).toLocaleDateString()}
								</span>

								{/* Actions */}
								<Button
									className={
										isBanned
											? "text-green-600 hover:bg-green-50 hover:text-green-600"
											: "text-destructive hover:bg-destructive/10 hover:text-destructive"
									}
									disabled={banMutation.isPending || unbanMutation.isPending}
									onClick={() => handleBan(user.id, isBanned)}
									size="icon"
									title={isBanned ? "Unban user" : "Ban user"}
									variant="ghost"
								>
									{isBanned ? <CheckCircle size={16} /> : <Ban size={16} />}
								</Button>
							</div>
						);
					})
				)}

				{/* Pagination */}
				<div className="flex items-center justify-between px-6 py-3">
					<span className="text-muted-foreground text-xs">
						{total} users total
					</span>
					<div className="flex items-center gap-1">
						<Button
							className="h-8 w-8"
							disabled={page === 1}
							onClick={() => setPage((p) => p - 1)}
							size="icon"
							variant="ghost"
						>
							{"<"}
						</Button>
						{Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
							<Button
								className="h-8 w-8 text-xs"
								key={p}
								onClick={() => setPage(p)}
								size="icon"
								variant={p === page ? "default" : "ghost"}
							>
								{p}
							</Button>
						))}
						<Button
							className="h-8 w-8"
							disabled={page === totalPages}
							onClick={() => setPage((p) => p + 1)}
							size="icon"
							variant="ghost"
						>
							{">"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
