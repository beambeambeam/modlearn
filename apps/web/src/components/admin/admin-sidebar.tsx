import { Link, useRouteContext, useRouterState, useNavigate } from "@tanstack/react-router";
import {
	BookOpen,
	ChartLine,
	ChartBar,
	ChevronRight,
	DollarSign,
	LogOut,
	Music,
	Settings,
	Users,
	FolderOpen,
	Tag,
	ClipboardList,
} from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const navItems = [
	{ label: "Dashboard", icon: ChartLine, to: "/admin/dashboard" },
	{ label: "Users", icon: Users, to: "/admin/users" },
	{ label: "Content", icon: Music, to: "/admin/content" },
	{
		label: "Playlist",
		icon: BookOpen,
		children: [
			{ label: "Manage Playlists", to: "/admin/playlists" },
			{ label: "Add Playlist", to: "/admin/playlists/new" },
		],
	},
	{ label: "Files",     icon: FolderOpen, to: "/admin/files" },
	{ label: "Categories", icon: Tag, to: "/admin/categories" },
	// { label: "Revenue", icon: DollarSign, to: "/admin/revenue" },
	{ label: "Analytics", icon: ChartBar, to: "/admin/analytics" },
	{ label: "Audit Logs", icon: ClipboardList, to: "/admin/audit-logs" },
	// { label: "Settings", icon: Settings, to: "/admin/settings" },
];

export default function AdminSidebar() {
	const navigate = useNavigate();
	const { session } = useRouteContext({ from: "/_admin-layout" });
	const user = session.data?.user;

	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [expanded, setExpanded] = useState<string[]>(
		pathname.startsWith("/admin/courses") ? ["Course"] : []
	);

	const toggleExpand = (label: string) => {
		setExpanded((prev) =>
			prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
		);
	};

	return (
		<aside className="flex w-52 flex-col gap-1 space-y-3 border-r bg-card px-3 py-6">
			{/* User info */}
			<div className="mb-6 flex items-center gap-2 px-3">
				<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-sm">
					{user?.name?.charAt(0).toUpperCase() ?? "A"}
				</div>
				<div>
					<p className="font-semibold text-sm leading-none">
						{user?.name ?? "Admin"}
					</p>
					<p className="mt-0.5 text-muted-foreground text-xs">Admin</p>
				</div>
			</div>

			{/* Nav */}
			{navItems.map((item) => {
				const isExpanded = expanded.includes(item.label);
				const isGroupActive = item.children?.some((c) => pathname === c.to);

				return (
					<div key={item.label}>
						{/* Item with child */}
						{item.children ? (
							<button
								className={`flex w-full text-muted-foreground items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors${
									isGroupActive
										? "font-medium bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
										: "text-muted-foreground hover:bg-accent hover:text-foreground"
								}`}
								onClick={() => toggleExpand(item.label)}
								type="button"
							>
								<item.icon size={16} />
								<span className="flex-1 text-left">{item.label}</span>
								<ChevronRight
									className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
									size={14}
								/>
							</button>
						) : (
							<Link
								activeProps={{
									className:
										"bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
								}}
								className="flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-foreground"
								to={item.to ?? "/admin/dashboard"}
							>
								<item.icon size={16} />
								{item.label}
							</Link>
						)}

						{/* Sub-menu */}
						{item.children && isExpanded && (
							<div className="mt-0.5 ml-4 flex flex-col gap-0.5 border-l pl-3">
								{item.children.map((child) => (
									<Link
										activeProps={{ className: "text-foreground font-medium" }}
										className="rounded-md px-2 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-foreground"
										key={child.to}
										to={child.to}
									>
										{child.label}
									</Link>
								))}
							</div>
						)}
					</div>
				);
			})}

			{/* Logout */}
			<div className="mt-auto">
				<button
					className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-foreground"
					onClick={() => {
						authClient.signOut({
							fetchOptions: {
								onSuccess: () => {
									navigate({
										to: "/",
									});
								},
							},
						});
					}}
					type="button"
				>
					<LogOut size={16} />
					Sign out
				</button>
			</div>
		</aside>
	);
}
