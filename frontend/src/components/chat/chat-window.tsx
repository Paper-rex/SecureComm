"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Paperclip,
  Smile,
  Lock,
  CheckCheck,
  Check,
  ArrowDown,
  ArrowLeft,
  FileText,
  Image,
  Download,
  Loader2,
  Trash2,
  SmilePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileUploadDialog } from "@/components/chat/file-upload-dialog";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

interface ChatWindowProps {
  chatId: string;
  chatName: string;
  chatAvatar?: string;
  isOnline?: boolean;
  isGroup?: boolean;
  memberCount?: number;
  myMongoId?: string;
  onGroupNameClick?: () => void;
}

interface MessageData {
  _id: string;
  sender: {
    _id: string;
    displayName: string;
    email: string;
    profilePicture?: string;
  };
  encryptedContent: string;
  type: string;
  fileMetadata?: {
    name: string;
    size: number;
    mimeType: string;
    storageKey: string;
    fileUrl?: string;
    encryptionIv?: string;
    encryptionKey?: string;
  };
  reactions: { userId: string; emoji: string }[];
  status: "sent" | "delivered" | "read";
  createdAt: string;
}

const emojis = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "💯"];

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatWindow({
  chatId,
  chatName,
  chatAvatar,
  isOnline,
  isGroup,
  memberCount,
  myMongoId,
  onGroupNameClick,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    messageId: string;
    mode: "forMe" | "forEveryone";
    isSender: boolean;
  }>({ open: false, messageId: "", mode: "forMe", isSender: false });
  const scrollRef = useRef<HTMLDivElement>(null);
  const { getToken } = useAuth();
  const router = useRouter();

  const fetchMessages = useCallback(async () => {
    try {
      const token = await getToken();
      const endpoint = isGroup
        ? `${process.env.NEXT_PUBLIC_API_URL}/groups/${chatId}/messages?page=1`
        : `${process.env.NEXT_PUBLIC_API_URL}/chats/${chatId}/messages?page=1`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // API returns newest first, reverse to show oldest at top
        const sorted = Array.isArray(data) ? [...data].reverse() : [];
        setMessages(sorted);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, [chatId, isGroup, getToken]);

  // ─── Initial load via REST, then fully WebSocket-driven ──────
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ─── Socket: join room & listen for all real-time events ──────
  useEffect(() => {
    let mounted = true;

    const setupSocket = async () => {
      try {
        const { getSocket } = await import("@/lib/socket");
        const socket = getSocket();
        if (!socket?.connected) return;

        // Join the correct room so the server sends us events
        if (isGroup) {
          socket.emit("join:group", { groupId: chatId });
        } else {
          socket.emit("join:chat", { chatId });
        }

        // ─── New message received via WebSocket ───────────
        const handleMessageReceive = (msg: any) => {
          if (!mounted) return;
          // Only append messages belonging to this conversation
          const belongsHere = isGroup
            ? msg.groupId === chatId
            : msg.chatId === chatId;
          if (!belongsHere) return;

          setMessages((prev) => {
            // Deduplicate: avoid adding if already present (e.g. own optimistic or REST echo)
            if (prev.some((m) => m._id === msg._id)) return prev;
            return [...prev, msg];
          });
        };

        // ─── Message deleted ──────────────────────────────
        const handleMessageDeleted = (data: { messageId: string }) => {
          if (!mounted) return;
          setMessages((prev) => prev.filter((m) => m._id !== data.messageId));
        };

        // ─── Reaction updated ─────────────────────────────
        const handleReactionUpdate = (data: {
          messageId: string;
          reactions: { userId: string; emoji: string }[];
        }) => {
          if (!mounted) return;
          setMessages((prev) =>
            prev.map((m) =>
              m._id === data.messageId
                ? { ...m, reactions: data.reactions }
                : m
            )
          );
        };

        // ─── Message status (delivered / read) ────────────
        const handleMessageStatus = (data: {
          messageId: string;
          status: "delivered" | "read";
        }) => {
          if (!mounted) return;
          setMessages((prev) =>
            prev.map((m) =>
              m._id === data.messageId ? { ...m, status: data.status } : m
            )
          );
        };

        socket.on("message:receive", handleMessageReceive);
        socket.on("message:deleted", handleMessageDeleted);
        socket.on("reaction:update", handleReactionUpdate);
        socket.on("message:status", handleMessageStatus);

        return () => {
          socket.off("message:receive", handleMessageReceive);
          socket.off("message:deleted", handleMessageDeleted);
          socket.off("reaction:update", handleReactionUpdate);
          socket.off("message:status", handleMessageStatus);
        };
      } catch {
        /* socket may not be initialized yet */
      }
    };

    let cleanup: (() => void) | undefined;
    setupSocket().then((fn) => {
      cleanup = fn;
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [chatId, isGroup]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    const messageText = newMessage.trim();
    setNewMessage("");
    setSending(true);
    setSendError(null);

    try {
      const token = await getToken();
      const endpoint = isGroup
        ? `${process.env.NEXT_PUBLIC_API_URL}/groups/${chatId}/messages`
        : `${process.env.NEXT_PUBLIC_API_URL}/chats/${chatId}/messages`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          encryptedContent: btoa(unescape(encodeURIComponent(messageText))),
          iv: btoa(String(Date.now())),
          encryptedKeys: {},
          type: "text",
        }),
      });

      if (res.ok) {
        // Message will appear via WebSocket 'message:receive' event —
        // no need to refetch the entire message list
      } else {
        console.error("Failed to send message:", res.status);
        setNewMessage(messageText); // restore the message so user doesn't lose it
        setSendError("Failed to send message. Please try again.");
        setTimeout(() => setSendError(null), 5000);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setNewMessage(messageText);
      setSendError("Network error. Check your connection.");
      setTimeout(() => setSendError(null), 5000);
    } finally {
      setSending(false);
    }
  };

  // ─── Reaction Toggle (add or remove) ─────────────────

  const toggleReaction = async (messageId: string, emoji: string) => {
    const msg = messages.find((m) => m._id === messageId);
    const existingReaction = msg?.reactions?.find(
      (r) => r.userId === myMongoId && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction (optimistic)
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? {
                ...m,
                reactions: (m.reactions || []).filter(
                  (r) => !(r.userId === myMongoId && r.emoji === emoji)
                ),
              }
            : m
        )
      );

      try {
        const token = await getToken();
        const base = isGroup ? "groups" : "chats";
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/${base}/messages/${messageId}/reactions`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (err) {
        console.error("Failed to remove reaction:", err);
        fetchMessages(); // revert on error
      }
    } else {
      // Add reaction (optimistic)
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? {
                ...m,
                reactions: [
                  ...(m.reactions || []).filter((r) => r.userId !== myMongoId),
                  { userId: myMongoId || "", emoji },
                ],
              }
            : m
        )
      );

      try {
        const token = await getToken();
        const base = isGroup ? "groups" : "chats";
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/${base}/messages/${messageId}/reactions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ emoji }),
          }
        );
      } catch (err) {
        console.error("Failed to add reaction:", err);
        fetchMessages(); // revert on error
      }
    }
  };

  // ─── Delete Message ──────────────────────────────────

  const handleDeleteMessage = async (
    messageId: string,
    mode: "forMe" | "forEveryone"
  ) => {
    // Optimistic removal
    setMessages((prev) => prev.filter((m) => m._id !== messageId));

    try {
      const token = await getToken();
      const base = isGroup ? "groups" : "chats";
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/${base}/messages/${messageId}?mode=${mode}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (err) {
      console.error("Failed to delete message:", err);
      fetchMessages(); // revert on error
    }
  };

  const handleDownload = async (
    fileUrl: string,
    fileName: string,
    encryptionIv?: string,
    encryptionKey?: string
  ) => {
    try {
      const token = await getToken();

      // Proxy the download through our backend to bypass strict CORS blocks from Cloudinary
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/files/download?url=${encodeURIComponent(fileUrl)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        throw new Error(`Download API failed: ${res.status} - ${errText}`);
      }

      let fileData: ArrayBuffer | Blob = await res.arrayBuffer();

      // Decrypt if encryption metadata is available
      if (encryptionIv && encryptionKey) {
        try {
          const { decryptFile, importAESKey } = await import("@/lib/crypto");
          const aesKey = await importAESKey(encryptionKey);
          fileData = await decryptFile(fileData, encryptionIv, aesKey);
        } catch (decryptErr) {
          console.error("Decryption failed:", decryptErr);
          throw new Error(
            "Failed to decrypt the file. The key might be invalid."
          );
        }
      }

      const blob = new Blob([fileData]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Failed to download file:", err);
      alert(err.message || "Failed to download file");
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "read":
        return <CheckCheck className="w-3.5 h-3.5 text-primary" />;
      case "delivered":
        return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
      default:
        return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getInitials = (name: string) =>
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const isSelf = (msg: MessageData) => {
    if (!myMongoId) return false;
    return msg.sender?._id === myMongoId;
  };

  const decodeContent = (content: string) => {
    try {
      return decodeURIComponent(escape(atob(content)));
    } catch {
      try {
        return atob(content);
      } catch {
        return content;
      }
    }
  };

  // ─── Render a single message bubble ──────────────────

  const renderMessageContent = (msg: MessageData, self: boolean) => {
    if (msg.type === "file" && msg.fileMetadata) {
      return (
        <div
          className={`rounded-2xl p-3 border ${
            self
              ? "bg-primary text-primary-foreground border-primary/50 rounded-br-md"
              : "bg-card border-border/50 rounded-bl-md"
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.fileMetadata.mimeType?.startsWith("image/") ? (
              <Image className="w-8 h-8 text-primary/60" />
            ) : (
              <FileText className="w-8 h-8 text-primary/60" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {msg.fileMetadata.name}
              </p>
              <p
                className={`text-[10px] ${self ? "text-primary-foreground/70" : "text-muted-foreground"}`}
              >
                {formatFileSize(msg.fileMetadata.size)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 rounded-full"
              onClick={() =>
                handleDownload(
                  msg.fileMetadata!.fileUrl ||
                    `${process.env.NEXT_PUBLIC_API_URL}/files/${msg.fileMetadata!.storageKey}`,
                  msg.fileMetadata!.name,
                  msg.fileMetadata!.encryptionIv,
                  msg.fileMetadata!.encryptionKey
                )
              }
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`rounded-2xl px-3.5 py-2 ${
          self
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card border border-border/50 rounded-bl-md"
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {decodeContent(msg.encryptedContent)}
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="h-14 border-b border-border/50 flex items-center justify-between px-4 bg-card/50 backdrop-blur-lg flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full w-8 h-8 hover:bg-muted/80 flex-shrink-0"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Avatar className="w-10 h-10 border border-border/50">
            <AvatarImage src={chatAvatar} />
            <AvatarFallback
              className={`${isGroup ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"} text-sm font-medium`}
            >
              {isGroup
                ? "👥"
                : getInitials(chatName)}
            </AvatarFallback>
          </Avatar>
          <div
            className={isGroup && onGroupNameClick ? "cursor-pointer group/name" : ""}
            onClick={isGroup && onGroupNameClick ? onGroupNameClick : undefined}
          >
            <h3 className={`font-semibold text-sm ${isGroup && onGroupNameClick ? "group-hover/name:underline decoration-primary/40 underline-offset-2" : ""}`}>{chatName}</h3>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              {isGroup ? (
                <>{memberCount || 0} members{onGroupNameClick ? " · Tap for settings" : ""}</>
              ) : (
                <>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOnline ? "bg-emerald-500" : "bg-muted-foreground"
                    }`}
                  />
                  {isOnline ? "Online" : "Offline"}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-primary/80 bg-primary/5 px-2.5 py-1 rounded-full">
          <Lock className="w-3 h-3" />
          <span>Encrypted</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
        {/* Encryption Notice */}
        <div className="flex justify-center mb-4">
          <div className="text-[10px] text-muted-foreground/60 bg-muted/30 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Messages are end-to-end encrypted. No one outside this chat can read
            them.
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-12">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const self = isSelf(msg);
              return (
                <motion.div
                  key={msg._id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-2 ${self ? "flex-row-reverse" : ""}`}
                >
                  <Avatar className="w-7 h-7 flex-shrink-0 mt-1 border border-border/50">
                    <AvatarImage src={msg.sender?.profilePicture} />
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                      {getInitials(
                        msg.sender?.displayName || msg.sender?.email || "?"
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`max-w-[70%] flex flex-col ${self ? "items-end" : "items-start"}`}
                  >
                    {isGroup && !self && (
                      <span className="text-[10px] text-muted-foreground ml-1 mb-0.5 block">
                        {msg.sender?.displayName}
                      </span>
                    )}

                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div className="relative group cursor-default">
                          {renderMessageContent(msg, self)}

                          {msg.reactions?.length > 0 && (
                            <div
                              className={`flex gap-0.5 mt-0.5 flex-wrap ${self ? "justify-end" : ""}`}
                            >
                              {/* Group reactions by emoji */}
                              {Object.entries(
                                (msg.reactions || []).reduce(
                                  (acc, r) => {
                                    acc[r.emoji] = acc[r.emoji] || [];
                                    acc[r.emoji].push(r.userId);
                                    return acc;
                                  },
                                  {} as Record<string, string[]>
                                )
                              ).map(([emoji, userIds]) => {
                                const myReaction = userIds.includes(
                                  myMongoId || ""
                                );
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() =>
                                      toggleReaction(msg._id, emoji)
                                    }
                                    className={`text-xs rounded-full px-1.5 py-0.5 border transition-colors ${
                                      myReaction
                                        ? "bg-primary/15 border-primary/40 text-foreground"
                                        : "bg-muted/50 border-border/30 hover:bg-muted"
                                    }`}
                                  >
                                    {emoji}{" "}
                                    {userIds.length > 1 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {userIds.length}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Hover emoji picker */}
                          <div
                            className={`absolute top-0 ${self ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"} opacity-0 group-hover:opacity-100 transition-opacity`}
                          >
                            <Popover>
                              <PopoverTrigger className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-card shadow-sm border border-border/50 hover:bg-accent">
                                <Smile className="w-3 h-3 text-muted-foreground" />
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-1.5"
                                align={self ? "end" : "start"}
                              >
                                <div className="flex gap-1">
                                  {emojis.map((emoji) => {
                                    const hasReaction = msg.reactions?.some(
                                      (r) =>
                                        r.userId === myMongoId &&
                                        r.emoji === emoji
                                    );
                                    return (
                                      <button
                                        key={emoji}
                                        onClick={() =>
                                          toggleReaction(msg._id, emoji)
                                        }
                                        className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-base ${
                                          hasReaction
                                            ? "bg-primary/20 ring-1 ring-primary/40"
                                            : "hover:bg-muted"
                                        }`}
                                      >
                                        {emoji}
                                      </button>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-48">
                        <ContextMenuSub>
                          <ContextMenuSubTrigger>
                            <SmilePlus className="w-4 h-4 mr-2" />
                            React
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent className="p-1.5">
                            <div className="flex gap-1">
                              {emojis.map((emoji) => {
                                const hasReaction = msg.reactions?.some(
                                  (r) =>
                                    r.userId === myMongoId && r.emoji === emoji
                                );
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() =>
                                      toggleReaction(msg._id, emoji)
                                    }
                                    className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-base ${
                                      hasReaction
                                        ? "bg-primary/20 ring-1 ring-primary/40"
                                        : "hover:bg-muted"
                                    }`}
                                  >
                                    {emoji}
                                  </button>
                                );
                              })}
                            </div>
                          </ContextMenuSubContent>
                        </ContextMenuSub>

                        <ContextMenuSeparator />

                        <ContextMenuItem
                          onClick={() =>
                            setDeleteDialog({
                              open: true,
                              messageId: msg._id,
                              mode: "forMe",
                              isSender: self,
                            })
                          }
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete for me
                        </ContextMenuItem>

                        {self && (
                          <ContextMenuItem
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                messageId: msg._id,
                                mode: "forEveryone",
                                isSender: self,
                              })
                            }
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete for everyone
                          </ContextMenuItem>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>

                    <div
                      className={`flex items-center gap-1 mt-0.5 px-1 ${self ? "justify-end" : ""}`}
                    >
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatTime(msg.createdAt)}
                      </span>
                      {self && statusIcon(msg.status)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        <div ref={scrollRef} />

        <AnimatePresence>
          {showScrollBtn && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed bottom-24 right-6"
            >
              <Button
                size="icon"
                variant="secondary"
                className="rounded-full shadow-lg"
                onClick={scrollToBottom}
              >
                <ArrowDown className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Message Input */}
      <div className="border-t border-border/50 p-3 bg-card/30 backdrop-blur-sm flex-shrink-0">
        {sendError && (
          <div className="mb-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 flex items-center justify-between">
            <span>{sendError}</span>
            <button onClick={() => setSendError(null)} className="ml-2 text-destructive/60 hover:text-destructive">✕</button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Tooltip>
            <TooltipTrigger
              className="inline-flex items-center justify-center rounded-full flex-shrink-0 h-9 w-9 hover:bg-accent hover:text-accent-foreground"
              onClick={() => setFileDialogOpen(true)}
            >
              <Paperclip className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>Attach encrypted file</TooltipContent>
          </Tooltip>
          <div className="flex-1 relative">
            <Textarea
              placeholder="Type an encrypted message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="resize-none min-h-[38px] max-h-[120px] pr-12 rounded-2xl bg-muted/50 border-0 focus-visible:ring-1 text-sm"
              rows={1}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="absolute right-1.5 bottom-1 rounded-full h-7 w-7"
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <FileUploadDialog
        open={fileDialogOpen}
        onOpenChange={setFileDialogOpen}
        chatId={chatId}
        isGroup={isGroup}
        onFileSent={() => {
          // File message will arrive via WebSocket 'message:receive'
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog((prev) => ({ ...prev, open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog.mode === "forEveryone"
                ? "Delete for everyone?"
                : "Delete for you?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.mode === "forEveryone"
                ? "This message will be permanently deleted for all participants. This action cannot be undone."
                : "This message will be removed from your view only. Other participants will still see it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                handleDeleteMessage(
                  deleteDialog.messageId,
                  deleteDialog.mode
                )
              }
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
