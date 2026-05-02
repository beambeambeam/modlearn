import { useRouterState } from "@tanstack/react-router";
import { ModeToggle } from "../mode-toggle";

const pageTitles: Record<string, string> = {
	"/admin/dashboard": "Dashboard",
	"/admin/users": "Users",
	"/admin/content": "Content",
	"/admin/playlists": "Playlist",
	"/admin/categories": "Categories",
	"/admin/files": "Files",
	"/admin/analytics": "Analytics",
	"/admin/settings": "Settings",
};

function getTitle(path: string): string {
	if (path.endsWith("/episodes")) {
		return "Episodes";
	}
	if (path.endsWith("/pricing")) {
		return "Pricing";
	}
	if (pageTitles[path]) {
		return pageTitles[path];
	}
	if (path.startsWith("/admin/playlists")) {
		return "Playlist";
	}
	if (path.startsWith("/admin/content")) {
		return "Content";
	}
	return "Dashboard";
}

export default function AdminHeader() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	return (
		<header className="flex items-center justify-between border-b bg-background px-6 py-4">
			<h1 className="font-bold text-xl">{getTitle(pathname)}</h1>
			<ModeToggle />
		</header>
	);
}
