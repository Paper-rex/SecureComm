"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  MessageSquare,
  Users,
  Hash,
  Lock,
  MailPlus,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserSearchDialog } from "@/components/chat/user-search-dialog";
import { CreateGroupDialog } from "@/components/group/create-group-dialog";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

interface SidebarProps {
  onClose?: () => void;
}

interface Participant {
  _id: string;
  email: string;
  displayName: string;
  profilePicture?: string;
  status: string;
}

interface ChatItem {
  _id: string;
  participants: Participant[];
  lastMessage?: {
    text: string;
    timestamp: string;
    senderId: string;
  };
  updatedAt: string;
}

interface GroupItem {
  _id: string;
  name: string;
  icon?: string;
  members: { _id: string }[];
  lastMessage?: {
    text: string;
    timestamp: string;
    senderName: string;
  };
  updatedAt: string;
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("chats");
  const [searchOpen, setSearchOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [myMongoId, setMyMongoId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { getToken } = useAuth();

  // Fetch current user's MongoDB _id once
  const fetchMe = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyMongoId(data._id);
      }
    } catch (err) {
      console.error("Failed to fetch current user:", err);
    }
  }, [getToken]);

  const fetchChats = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    } finally {
      setLoadingChats(false);
    }
  }, [getToken]);

  const fetchGroups = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchMe();
    fetchChats();
    fetchGroups();
  }, [fetchMe, fetchChats, fetchGroups]);

  // Refresh when dialog closes
  useEffect(() => {
    if (!searchOpen) fetchChats();
    if (!groupOpen) fetchGroups();
  }, [searchOpen, groupOpen, fetchChats, fetchGroups]);

  const getOtherParticipant = (chat: ChatItem): Participant | null => {
    if (!myMongoId || !chat.participants) return chat.participants?.[0] || null;
    // Find the participant whose _id does NOT match the current user's MongoDB _id
    const other = chat.participants.find((p) => p._id !== myMongoId);
    return other || chat.participants[0] || null;
  };

  const filteredChats = chats.filter((c) => {
    const other = getOtherParticipant(c);
    if (!other) return false;
    const q = searchQuery.toLowerCase();
    return (
      other.displayName?.toLowerCase().includes(q) ||
      other.email?.toLowerCase().includes(q)
    );
  });

  const filteredGroups = groups.filter((g) =>
    g.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full w-full bg-card/30">
      {/* Search & Actions */}
      <div className="p-4 space-y-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-primary/10 flex-shrink-0"
            onClick={() => setSearchOpen(true)}
          >
            <MailPlus className="w-4 h-4 text-primary" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-primary/10 flex-shrink-0"
            onClick={() => setGroupOpen(true)}
          >
            <Plus className="w-4 h-4 text-primary" />
          </Button>
        </div>

        <Tabs defaultValue="chats" onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2 h-9 rounded-full bg-muted/50">
            <TabsTrigger value="chats" className="rounded-full text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Chats
            </TabsTrigger>
            <TabsTrigger value="groups" className="rounded-full text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Groups
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Separator className="opacity-50" />

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          <AnimatePresence mode="wait">
            {activeTab === "chats" ? (
              <motion.div
                key="chats"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-0.5"
              >
                {loadingChats ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                ) : filteredChats.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-8">
                    No chats yet. Use the invite button to start a conversation.
                  </div>
                ) : (
                  filteredChats.map((chat, i) => {
                    const other = getOtherParticipant(chat);
                    if (!other) return null;
                    const isActive = pathname?.includes(chat._id);
                    return (
                      <motion.button
                        key={chat._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => {
                          router.push(`/chat/${chat._id}`);
                          onClose?.();
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left group ${
                          isActive
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={other.profilePicture} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                              {other.displayName?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          {other.status === "online" && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-card rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate">{other.displayName}</span>
                            <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                              {chat.lastMessage?.timestamp
                                ? getTimeAgo(chat.lastMessage.timestamp)
                                : getTimeAgo(chat.updatedAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <Lock className="w-3 h-3 text-primary/60 flex-shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">
                                {chat.lastMessage?.text || "Start a conversation"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </motion.div>
            ) : (
              <motion.div
                key="groups"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-0.5"
              >
                {loadingGroups ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-8">
                    No groups yet. Create one to start collaborating.
                  </div>
                ) : (
                  filteredGroups.map((group, i) => {
                    const isActive = pathname?.includes(group._id);
                    return (
                      <motion.button
                        key={group._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => {
                          router.push(`/group/${group._id}`);
                          onClose?.();
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left group ${
                          isActive
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <Avatar className="w-10 h-10 border border-border/50">
                          <AvatarImage src={group.icon?.startsWith('http') ? group.icon : undefined} />
                          <AvatarFallback className="bg-amber-500/10 text-amber-500 text-sm font-medium">
                            {group.icon && !group.icon.startsWith('http') ? group.icon : "👥"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate">{group.name}</span>
                            <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                              {group.lastMessage?.timestamp
                                ? getTimeAgo(group.lastMessage.timestamp)
                                : getTimeAgo(group.updatedAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <Hash className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">
                                {group.lastMessage?.text || `${group.members?.length || 0} members`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Encryption Badge */}
      <div className="p-3 flex-shrink-0">
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/70 py-2 px-3 rounded-full bg-muted/30">
          <Lock className="w-3 h-3" />
          <span>End-to-end encrypted</span>
        </div>
      </div>

      {/* Dialogs */}
      <UserSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <CreateGroupDialog open={groupOpen} onOpenChange={setGroupOpen} />
    </div>
  );
}
