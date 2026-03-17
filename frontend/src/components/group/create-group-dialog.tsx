"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, X, Mail, Shield, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { getToken } = useAuth();

  const addMember = () => {
    const email = memberEmail.trim().toLowerCase();
    if (email && email.includes("@") && !members.includes(email)) {
      setMembers([...members, email]);
      setMemberEmail("");
    }
  };

  const removeMember = (email: string) => {
    setMembers(members.filter((m) => m !== email));
  };

  const handleCreate = async () => {
    if (!groupName.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: description.trim() || undefined,
          memberEmails: members,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create group");
      }

      const group = await res.json();
      onOpenChange(false);

      // Reset form
      setGroupName("");
      setDescription("");
      setMembers([]);

      // Navigate to the new group
      router.push(`/group/${group._id}`);
    } catch (err) {
      console.error("Failed to create group:", err);
      setError("Failed to create group. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border-border/50">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-b from-primary/5 to-transparent">
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Create Group Chat
          </DialogTitle>
          <DialogDescription>
            All group messages are end-to-end encrypted
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Group Name */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Group Name</Label>
            <Input
              placeholder="e.g., Security Team"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="h-10"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Description <span className="text-muted-foreground/50">(optional)</span>
            </Label>
            <Textarea
              placeholder="What's this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none h-20"
            />
          </div>

          {/* Add Members */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Add Members by Email</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="member@example.com"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMember())}
                  className="pl-9 h-10"
                />
              </div>
              <Button
                variant="secondary"
                onClick={addMember}
                disabled={!memberEmail.includes("@")}
                className="h-10"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Member Tags */}
          {members.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex flex-wrap gap-1.5"
            >
              {members.map((email) => (
                <Badge
                  key={email}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 gap-1 text-xs rounded-full"
                >
                  {email}
                  <button
                    onClick={() => removeMember(email)}
                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-muted-foreground/20"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 text-center">
              {error}
            </div>
          )}

          {/* Security Note */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 text-xs text-muted-foreground">
            <Shield className="w-4 h-4 text-primary flex-shrink-0" />
            <span>
              You&apos;ll be the group creator with full admin privileges. Messages are encrypted for all members.
            </span>
          </div>

          <Button
            onClick={handleCreate}
            disabled={!groupName.trim() || creating}
            className="w-full rounded-full gap-2"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            {creating ? "Creating..." : "Create Encrypted Group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
