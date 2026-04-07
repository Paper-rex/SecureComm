"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { ChatWindow } from "@/components/chat/chat-window";
import { GroupSettingsSheet } from "@/components/group/group-settings-sheet";
import { Shield } from "lucide-react";
import { motion } from "framer-motion";

interface GroupData {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  creator: any;
  admins: any[];
  members: any[];
}

export default function GroupPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [myMongoId, setMyMongoId] = useState<string | null>(null);
  const { getToken } = useAuth();
  const router = useRouter();

  const fetchGroup = useCallback(async () => {
    try {
      const token = await getToken();

      // Fetch current user's MongoDB ID
      if (!myMongoId) {
        const meRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/me`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (meRes.ok) {
          const me = await meRes.json();
          setMyMongoId(me._id);
        }
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/groups`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const groups = await res.json();
        const found = groups.find((g: any) => g._id === groupId);
        if (found) setGroup(found);
      }
    } catch (err) {
      console.error("Failed to fetch group:", err);
    } finally {
      setLoading(false);
    }
  }, [groupId, getToken, myMongoId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  // Re-fetch group data when settings sheet closes (icon/name might have changed)
  useEffect(() => {
    if (!settingsOpen) {
      fetchGroup();
    }
  }, [settingsOpen, fetchGroup]);

  // Listen for real-time group updates via WebSocket
  useEffect(() => {
    let mounted = true;

    const setupListeners = async () => {
      try {
        const { getSocket } = await import("@/lib/socket");
        const socket = getSocket();
        if (!socket?.connected) return;

        const handleGroupUpdated = () => {
          if (!mounted) return;
          fetchGroup();
        };

        const handleGroupDeleted = (data: { groupId: string }) => {
          if (!mounted) return;
          if (data.groupId === groupId) {
            router.push("/dashboard");
          }
        };

        socket.on("group:updated", handleGroupUpdated);
        socket.on("group:deleted", handleGroupDeleted);

        return () => {
          socket.off("group:updated", handleGroupUpdated);
          socket.off("group:deleted", handleGroupDeleted);
        };
      } catch { /* socket may not exist */ }
    };

    let cleanup: (() => void) | undefined;
    setupListeners().then((fn) => { cleanup = fn; });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [fetchGroup, groupId, router]);

  // Determine the avatar to pass — only pass URL-based icons, not emoji characters
  const groupAvatar = group?.icon?.startsWith("http") ? group.icon : undefined;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Shield className="w-6 h-6 text-primary" />
        </motion.div>
      </div>
    );
  }

  // Group not found (deleted or not a member) — redirect to dashboard
  if (!group) {
    router.push("/dashboard");
    return null;
  }

  return (
    <div className="flex flex-col h-full relative">
      <ChatWindow
        chatId={groupId}
        chatName={group?.name || "Group"}
        chatAvatar={groupAvatar}
        isGroup={true}
        memberCount={group?.members?.length || 0}
        myMongoId={myMongoId || undefined}
        onGroupNameClick={() => setSettingsOpen(true)}
      />
      <GroupSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        groupId={groupId}
        onGroupUpdated={fetchGroup}
      />
    </div>
  );
}
