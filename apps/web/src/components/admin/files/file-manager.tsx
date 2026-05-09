import { useRef, useState } from "react";
import {
  Upload, Copy, Trash2, FileVideo,
  FileAudio, FileImage, File, CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadFile, useDeleteFile, useGetDownloadUrl } from "@/hooks/file/use-file";
import { toast } from "sonner";

interface UploadedFile {
  fileId:     string;
  name:       string;
  size:       number;
  mimeType:   string;
  uploadedAt: Date;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("video/"))  return <FileVideo  size={16} className="text-blue-500" />;
  if (mimeType.startsWith("audio/"))  return <FileAudio  size={16} className="text-purple-500" />;
  if (mimeType.startsWith("image/"))  return <FileImage  size={16} className="text-green-500" />;
  return <File size={16} className="text-muted-foreground" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileManager() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles]       = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);

  const { upload, isPending } = useUploadFile();
  const deleteMutation        = useDeleteFile();
  const downloadMutation      = useGetDownloadUrl();

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    for (const file of Array.from(fileList)) {
      try {
        const fileId = await upload(file);
        setFiles((prev) => [
          { fileId, name: file.name, size: file.size, mimeType: file.type, uploadedAt: new Date() },
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

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop      = (e: React.DragEvent) => {
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
        type="button"
        className={dropZoneClass}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload size={22} className="text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            {isPending ? "Uploading..." : "Drop files here or click to upload"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Video, Audio, Image — any format
          </p>
        </div>
        <input
          ref={inputRef}
          id="file-upload"
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </button>

      {/* File List */}
      {files.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="grid grid-cols-[32px_1fr_80px_120px_auto] gap-4 px-6 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span />
            <span>File</span>
            <span>Size</span>
            <span>File ID</span>
            <span />
          </div>

          {files.map((f) => (
            <div
              key={f.fileId}
              className="grid grid-cols-[32px_1fr_80px_120px_auto] gap-4 items-center px-6 py-4 border-b last:border-0 hover:bg-muted/30 transition-colors"
            >
              <FileIcon mimeType={f.mimeType} />

              <div>
                <p className="text-sm font-medium truncate max-w-xs">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {f.uploadedAt.toLocaleTimeString()}
                </p>
              </div>

              <span className="text-sm text-muted-foreground">
                {formatSize(f.size)}
              </span>

              <code className="text-xs text-muted-foreground truncate max-w-[120px] block">
                {f.fileId.slice(0, 8)}...
              </code>

              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" title="Copy File ID" onClick={() => handleCopy(f.fileId)}>
                  <Copy size={15} />
                </Button>
                <Button type="button" variant="ghost" size="icon" title="Download" onClick={() => handleDownload(f.fileId)}>
                  <CheckCircle size={15} />
                </Button>
                <Button
                  type="button"
                  variant="ghost" size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deleteMutation.isPending}
                  onClick={() => handleDelete(f.fileId)}
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
          <p className="text-sm text-muted-foreground">
            No files uploaded yet - files uploaded here will appear in this session
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Copy the <strong>File ID</strong> to use in Content or Playlist forms
          </p>
        </div>
      )}
    </div>
  );
}