import {
	CheckCircle,
	Copy,
	File,
	FileAudio,
	FileImage,
	FileVideo,
	Trash2,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	useDeleteFile,
	useGetDownloadUrl,
	useUploadFile,
} from "@/hooks/file/use-file";

interface UploadedFile {
	fileId: string;
	name: string;
	size: number;
	mimeType: string;
	uploadedAt: Date;
}

function FileIcon({ mimeType }: { mimeType: string }) {
	if (mimeType.startsWith("video/")) {
		return <FileVideo className="text-blue-500" size={16} />;
	}
	if (mimeType.startsWith("audio/")) {
		return <FileAudio className="text-purple-500" size={16} />;
	}
	if (mimeType.startsWith("image/")) {
		return <FileImage className="text-green-500" size={16} />;
	}
	return <File className="text-muted-foreground" size={16} />;
}

function formatSize(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileManager() {
	const inputRef = useRef<HTMLInputElement>(null);
	const [files, setFiles] = useState<UploadedFile[]>([]);
	const [dragging, setDragging] = useState(false);

	const { upload, isPending } = useUploadFile();
	const deleteMutation = useDeleteFile();
	const downloadMutation = useGetDownloadUrl();

	const handleUpload = async (fileList: FileList | null) => {
		if (!fileList || fileList.length === 0) {
			return;
		}

		for (const file of Array.from(fileList)) {
			try {
				const fileId = await upload(file);
				setFiles((prev) => [
					{
						fileId,
						name: file.name,
						size: file.size,
						mimeType: file.type,
						uploadedAt: new Date(),
					},
					...prev,
				]);
				toast.success(`Uploaded: ${file.name}`);
			} catch {
				toast.error(`Failed to upload: ${file.name}`);
			}
		}
	};

	const handleCopy = (fileId: string) => {
		navigator.clipboard.writeText(fileId);
		toast.success("File ID copied to clipboard");
	};

	const handleDownload = async (fileId: string) => {
		try {
			const { downloadUrl } = await downloadMutation.mutateAsync({ fileId });
			window.open(downloadUrl, "_blank");
		} catch {
			toast.error("Failed to get download URL");
		}
	};

	const handleDelete = (fileId: string) => {
		deleteMutation.mutate(
			{ fileId },
			{
				onSuccess: () => {
					setFiles((prev) => prev.filter((f) => f.fileId !== fileId));
					toast.success("File deleted");
				},
				onError: () => toast.error("Failed to delete file"),
			}
		);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setDragging(true);
	};
	const handleDragLeave = () => setDragging(false);
	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setDragging(false);
		handleUpload(e.dataTransfer.files);
	};

	const dropZoneClass = [
		"rounded-xl border-2 border-dashed p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors w-full text-center",
		dragging
			? "border-primary bg-primary/5"
			: "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
	].join(" ");

	return (
		<div className="space-y-4">
			{/* Drop Zone — using <label> so it's semantically interactive */}
			<button
				className={dropZoneClass}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				type="button"
			>
				<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
					<Upload className="text-primary" size={22} />
				</div>
				<div className="text-center">
					<p className="font-medium text-sm">
						{isPending ? "Uploading..." : "Drop files here or click to upload"}
					</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Video, Audio, Image — any format
					</p>
				</div>
				<input
					className="hidden"
					id="file-upload"
					multiple
					onChange={(e) => handleUpload(e.target.files)}
					ref={inputRef}
					type="file"
				/>
			</button>

			{/* File List */}
			{files.length > 0 && (
				<div className="rounded-xl border bg-card">
					<div className="grid grid-cols-[32px_1fr_80px_120px_auto] gap-4 border-b px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
						<span />
						<span>File</span>
						<span>Size</span>
						<span>File ID</span>
						<span />
					</div>

					{files.map((f) => (
						<div
							className="grid grid-cols-[32px_1fr_80px_120px_auto] items-center gap-4 border-b px-6 py-4 transition-colors last:border-0 hover:bg-muted/30"
							key={f.fileId}
						>
							<FileIcon mimeType={f.mimeType} />

							<div>
								<p className="max-w-xs truncate font-medium text-sm">
									{f.name}
								</p>
								<p className="text-muted-foreground text-xs">
									{f.uploadedAt.toLocaleTimeString()}
								</p>
							</div>

							<span className="text-muted-foreground text-sm">
								{formatSize(f.size)}
							</span>

							<code className="block max-w-[120px] truncate text-muted-foreground text-xs">
								{f.fileId.slice(0, 8)}...
							</code>

							<div className="flex items-center gap-1">
								<Button
									onClick={() => handleCopy(f.fileId)}
									size="icon"
									title="Copy File ID"
									type="button"
									variant="ghost"
								>
									<Copy size={15} />
								</Button>
								<Button
									onClick={() => handleDownload(f.fileId)}
									size="icon"
									title="Download"
									type="button"
									variant="ghost"
								>
									<CheckCircle size={15} />
								</Button>
								<Button
									className="text-destructive hover:bg-destructive/10 hover:text-destructive"
									disabled={deleteMutation.isPending}
									onClick={() => handleDelete(f.fileId)}
									size="icon"
									type="button"
									variant="ghost"
								>
									<Trash2 size={15} />
								</Button>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Empty state */}
			{files.length === 0 && !isPending && (
				<div className="rounded-xl border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No files uploaded yet - files uploaded here will appear in this
						session
					</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Copy the <strong>File ID</strong> to use in Content or Playlist
						forms
					</p>
				</div>
			)}
		</div>
	);
}
