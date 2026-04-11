import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_admin-layout/admin/dashboard")({
	component: AdminDashboardPage,
});

function AdminDashboardPage() {
	return (
		<div className="space-y-6">
			{/* Page Title */}
			<h1 className="font-bold text-2xl">Dashboard</h1>

			{/* Stat Cards Row */}
			<div className="grid grid-cols-4 gap-4">
				<StatCard
					change="+12.5% from last month"
					title="Total Users"
					value="45,283"
				/>
				<StatCard
					change="+8.2% from last month"
					title="Active Listeners"
					value="2,847"
				/>
				<StatCard
					change="+15.3% from last month"
					title="Total Revenue"
					value="$127,584"
				/>
				<StatCard
					change="-2.1% from last month"
					negative
					title="Content Uploads"
					value="1,294"
				/>
			</div>

			{/* Charts Row */}
			<div className="grid grid-cols-2 gap-4">
				<Card className="rounded-md p-4">
					<p>User Growth</p>
				</Card>
				<Card className="rounded-md p-4">
					<p>Revenue Analytics</p>
				</Card>
			</div>

			{/* Bottom Row */}
			<div className="grid grid-cols-3 gap-4">
				<Card className="rounded-md p-4">
					<p>Platform Distribution</p>
				</Card>
				<Card className="col-span-2 rounded-md p-4">
					<p>Recent Activities</p>
				</Card>
			</div>

			{/* Quick Actions */}
			<Card className="rounded-md p-4">
				<p>Quick Actions</p>
			</Card>
		</div>
	);
}

// Stat card
function StatCard({
	title,
	value,
	change,
	negative = false,
}: {
	title: string;
	value: string;
	change: string;
	negative?: boolean;
}) {
	return (
		<Card className="rounded-md p-4">
			<p className="text-muted-foreground text-sm">{title}</p>
			<p className="font-bold text-2xl">{value}</p>
			<p
				className={`text-xs ${negative ? "text-yellow-500" : "text-green-500"}`}
			>
				{change}
			</p>
		</Card>
	);
}
