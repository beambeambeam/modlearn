import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useUploadFile() {
  const requestMutation = useMutation(
    orpc.file.adminCreateUploadRequest.mutationOptions()
  );

  const upload = async (file: File): Promise<string> => {
    const buffer   = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const checksum = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const extension = file.name.split(".").pop() ?? "";

    const { fileId, uploadUrl } = await requestMutation.mutateAsync({
      name:      file.name,
      size:      file.size,
      mimeType:  file.type,
      extension,
      checksum,
    });

    await fetch(uploadUrl, {
      method:  "PUT",
      body:    file,
      headers: { "Content-Type": file.type },
    });

    return fileId;
  };

  return {
    upload,
    isPending: requestMutation.isPending,
    isError:   requestMutation.isError,
    error:     requestMutation.error,
  };
}

export function useGetDownloadUrl() {
  return useMutation(orpc.file.adminGetDownloadUrl.mutationOptions());
}

export function useDeleteFile() {
  return useMutation(orpc.file.adminDelete.mutationOptions());
}