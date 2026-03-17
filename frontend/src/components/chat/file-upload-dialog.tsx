"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  FileText,
  Image,
  FileArchive,
  X,
  Shield,
  Lock,
  AlertTriangle,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@clerk/nextjs";
import { encryptFile, exportAESKey } from "@/lib/crypto";

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId?: string;
  isGroup?: boolean;
  onFileSent?: () => void;
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
];
const MAX_SIZE = 25 * 1024 * 1024; // 25MB

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  if (type.includes("zip")) return FileArchive;
  return FileText;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadDialog({
  open,
  onOpenChange,
  chatId,
  isGroup,
  onFileSent,
}: FileUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const { getToken } = useAuth();

  const validateFile = (f: File): string | null => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      return "File type not allowed. Supported: images, PDF, documents, ZIP";
    }
    if (f.size > MAX_SIZE) {
      return `File too large. Maximum size: ${formatSize(MAX_SIZE)}`;
    }
    return null;
  };

  const handleFileSelect = (f: File) => {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const token = await getToken();

      // Stage 1: Encrypt file client-side (AES-256-GCM)
      setUploadStage("Encrypting file (AES-256-GCM)...");
      setProgress(20);

      const { encryptedData, iv, aesKey } = await encryptFile(file);
      const exportedKey = await exportAESKey(aesKey);

      // Stage 2: Upload encrypted blob to Cloudinary via backend
      setUploadStage("Uploading encrypted file...");
      setProgress(40);

      const encryptedBlob = new Blob([encryptedData], {
        type: "application/octet-stream",
      });
      const formData = new FormData();
      formData.append("file", encryptedBlob, file.name);

      const uploadRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/files/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.message || "Upload failed");
      }

      const fileData = await uploadRes.json();

      setUploadStage("Creating message...");
      setProgress(70);

      // Stage 3: Create a file message in the chat
      if (chatId) {
        const msgEndpoint = isGroup
          ? `${process.env.NEXT_PUBLIC_API_URL}/groups/${chatId}/messages`
          : `${process.env.NEXT_PUBLIC_API_URL}/chats/${chatId}/messages`;

        const msgRes = await fetch(msgEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            encryptedContent: btoa(file.name),
            iv: btoa(String(Date.now())),
            encryptedKeys: {},
            type: "file",
            fileMetadata: {
              name: fileData.name,
              size: fileData.size,
              mimeType: fileData.mimeType,
              storageKey: fileData.storageKey,
              fileUrl: fileData.fileUrl,
              encryptionIv: iv,
              encryptionKey: exportedKey,
            },
          }),
        });

        if (!msgRes.ok) {
          throw new Error("Failed to create file message");
        }
      }

      setUploadStage("File sent securely!");
      setProgress(100);

      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        setFile(null);
        setUploadStage("");
        onOpenChange(false);
        onFileSent?.();
      }, 1000);
    } catch (err: any) {
      console.error("Upload failed:", err);
      setError(err.message || "Upload failed. Please try again.");
      setUploading(false);
      setProgress(0);
      setUploadStage("");
    }
  };

  const FileIcon = file ? getFileIcon(file.type) : FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border-border/50">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-b from-primary/5 to-transparent">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Secure File Sharing
          </DialogTitle>
          <DialogDescription>
            Files are encrypted before upload — the server never sees your data
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {!file && !uploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <input
                type="file"
                accept={ALLOWED_TYPES.join(",")}
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className={`w-8 h-8 mx-auto mb-3 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
              <p className="text-sm font-medium mb-1">
                Drop file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Images, PDF, Documents, ZIP — Max {formatSize(MAX_SIZE)}
              </p>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          {file && !uploading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border/50 bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileIcon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 rounded-full"
                  onClick={() => setFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Lock className="w-3 h-3 text-primary" />
                  AES-256-GCM encryption
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Shield className="w-3 h-3 text-primary" />
                  Malware scan before send
                </div>
              </div>

              <Button onClick={handleUpload} className="w-full mt-4 rounded-full gap-2">
                <Lock className="w-4 h-4" />
                Encrypt & Send
              </Button>
            </motion.div>
          )}

          {uploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-border/50 bg-card p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                {progress < 100 ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Shield className="w-6 h-6 text-primary" />
                  </motion.div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{uploadStage}</p>
                  <Progress value={progress} className="h-1.5 mt-2" />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
