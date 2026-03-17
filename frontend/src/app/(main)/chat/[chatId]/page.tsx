"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ChatWindow } from "@/components/chat/chat-window";
import { Shield } from "lucide-react";
import { motion } from "framer-motion";

export default function ChatPage() {
  const params = useParams();
  const chatId = params.chatId as string;
  const { getToken } = useAuth();
  const [chatName, setChatName] = useState("Loading...");
  const [chatAvatar, setChatAvatar] = useState<string | undefined>(undefined);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myMongoId, setMyMongoId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await getToken();

        // 1. Get current user's MongoDB _id
        const meRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/me`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const me = meRes.ok ? await meRes.json() : null;
        if (me) setMyMongoId(me._id);

        // 2. Get chat list
        const chatsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/chats`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!chatsRes.ok) throw new Error("Failed to fetch chats");
        const chats = await chatsRes.json();

        const currentChat = chats.find((c: any) => c._id === chatId);

        if (currentChat && currentChat.participants?.length >= 2 && me) {
          // Find the OTHER participant (not me)
          const other = currentChat.participants.find(
            (p: any) => p._id !== me._id
          );
          if (other) {
            setChatName(other.displayName || other.email || "Chat");
            setChatAvatar(other.profilePicture);
            setIsOnline(other.status === "online");
          } else {
            // Fallback
            const p = currentChat.participants[0];
            setChatName(p.displayName || p.email || "Chat");
            setChatAvatar(p.profilePicture);
          }
        } else if (currentChat?.participants?.length === 1) {
          const p = currentChat.participants[0];
          setChatName(p.displayName || p.email || "Chat");
          setChatAvatar(p.profilePicture);
          setIsOnline(p.status === "online");
        } else {
          setChatName("Chat");
          setChatAvatar(undefined);
        }
      } catch (err) {
        console.error("Failed to fetch chat details:", err);
        setChatName("Chat");
        setChatAvatar(undefined);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [chatId, getToken]);

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
    <ChatWindow
      chatId={chatId}
      chatName={chatName}
      chatAvatar={chatAvatar}
      isOnline={isOnline}
      myMongoId={myMongoId || undefined}
    />
  );
}
