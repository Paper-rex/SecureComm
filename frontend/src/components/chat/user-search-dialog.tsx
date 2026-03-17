"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, UserPlus, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

interface UserSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FoundUser {
  _id: string;
  email: string;
  displayName: string;
  profilePicture?: string;
  status: string;
}

export function UserSearchDialog({ open, onOpenChange }: UserSearchDialogProps) {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<"found" | "not-found" | null>(null);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { getToken } = useAuth();

  const handleSearch = async () => {
    if (!email.trim()) return;
    setSearching(true);
    setResult(null);
    setInviteSent(false);
    setFoundUser(null);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/search?email=${encodeURIComponent(email.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();

      if (data.found) {
        setResult("found");
        setFoundUser(data.user);
      } else {
        setResult("not-found");
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search. Make sure the backend is running.");
      setResult(null);
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async () => {
    setInviting(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email: email.trim() }),
        }
      );

      if (!response.ok) {
        throw new Error("Invite failed");
      }

      setInviteSent(true);
    } catch (err) {
      console.error("Invite error:", err);
      setError("Failed to send invitation. Check backend logs.");
    } finally {
      setInviting(false);
    }
  };

  const handleStartChat = async () => {
    if (!foundUser) return;

    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chats`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ participantId: foundUser._id }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create chat");
      }

      const chat = await response.json();
      onOpenChange(false);
      router.push(`/chat/${chat._id}`);
    } catch (err) {
      console.error("Chat creation error:", err);
      setError("Failed to create chat.");
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden border-border/50">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-b from-primary/5 to-transparent">
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Find or Invite User
          </DialogTitle>
          <DialogDescription>
            Search by email to start an encrypted conversation
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Email Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter email address..."
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setResult(null);
                  setInviteSent(false);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 h-10"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!email.trim() || searching}
              className="h-10 px-4"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 text-center"
            >
              {error}
            </motion.div>
          )}

          {/* Results */}
          <AnimatePresence mode="wait">
            {result === "found" && foundUser && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-xl border border-border/50 bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(foundUser.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{foundUser.displayName}</h4>
                    <p className="text-xs text-muted-foreground">{foundUser.email}</p>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-primary">
                      <Lock className="w-3 h-3" />
                      <span>Public key verified</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleStartChat}
                    className="rounded-full gap-1.5"
                  >
                    Chat
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {result === "not-found" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-xl border border-border/50 bg-card p-5 text-center"
              >
                {!inviteSent ? (
                  <>
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <UserPlus className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h4 className="font-semibold text-sm mb-1">User not found</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      &quot;{email}&quot; is not registered on SecureComm yet.
                    </p>
                    <Button onClick={handleInvite} disabled={inviting} className="rounded-full gap-2">
                      {inviting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      {inviting ? "Sending..." : "Send Invitation"}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <h4 className="font-semibold text-sm mb-1">Invitation Sent!</h4>
                    <p className="text-xs text-muted-foreground">
                      An invitation email has been sent to <strong>{email}</strong>.
                      The chat will activate once they register.
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
