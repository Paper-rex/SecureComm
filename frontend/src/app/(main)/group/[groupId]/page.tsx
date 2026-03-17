"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ChatWindow } from "@/components/chat/chat-window";
import { GroupSettingsSheet } from "@/components/group/group-settings-sheet";
import { Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const { getToken } = useAuth();

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const token = await getToken();
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
    };
    fetchGroup();
  }, [groupId, getToken]);

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

  return (
    <div className="flex flex-col h-full relative">
      <ChatWindow
        chatId={groupId}
        chatName={group?.name || "Group"}
        isGroup={true}
        memberCount={group?.members?.length || 0}
      />
      {/* Group Settings Toggle */}
      <div className="absolute top-3 right-28">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
      <GroupSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        groupId={groupId}
      />
    </div>
  );
}
