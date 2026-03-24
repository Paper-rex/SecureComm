"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Settings,
  Shield,
  Crown,
  Star,
  UserMinus,
  UserPlus,
  ChevronUp,
  ChevronDown,
  Edit2,
  LogOut,
  Mail,
  Lock,
  Loader2,
  Camera,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@clerk/nextjs";
import { getSocket } from "@/lib/socket";

interface GroupSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string;
}

interface MemberData {
  _id: string;
  displayName: string;
  email: string;
  profilePicture?: string;
  status: string;
}

interface GroupData {
  _id: string;
  name: string;
  description: string;
  icon: string;
  creator: MemberData;
  admins: MemberData[];
  members: MemberData[];
  createdAt: string;
}

function getRole(member: MemberData, group: GroupData): "creator" | "admin" | "member" {
  if (group.creator?._id === member._id) return "creator";
  if (group.admins?.some((a) => a._id === member._id)) return "admin";
  return "member";
}

function getRoleIcon(role: string) {
  switch (role) {
    case "creator":
      return <Crown className="w-3.5 h-3.5 text-amber-500" />;
    case "admin":
      return <Star className="w-3.5 h-3.5 text-primary" />;
    default:
      return null;
  }
}

function getRoleBadge(role: string) {
  switch (role) {
    case "creator":
      return <Badge className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 rounded-full px-2" variant="outline">Creator</Badge>;
    case "admin":
      return <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 rounded-full px-2" variant="outline">Admin</Badge>;
    default:
      return null;
  }
}

export function GroupSettingsSheet({ open, onOpenChange, groupId }: GroupSettingsSheetProps) {
  const [editing, setEditing] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupIcon, setGroupIcon] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    if (!open || !groupId) return;

    const fetchGroup = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/groups`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const groups = await res.json();
          const found = groups.find((g: any) => g._id === groupId);
          if (found) {
            setGroup(found);
            setGroupName(found.name);
            setGroupDesc(found.description || "");
            setGroupIcon(found.icon || "");
          }
        }
      } catch (err) {
        console.error("Failed to fetch group:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, [open, groupId, getToken]);

  const handleSaveEdit = async () => {
    if (!groupId) return;
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups/${groupId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: groupName, description: groupDesc, icon: groupIcon }),
      });
      setEditing(false);
      // Refresh group data
      if (group) setGroup({ ...group, name: groupName, description: groupDesc, icon: groupIcon });
      // Emit WebSocket event so other clients update in real time
      try {
        const socket = getSocket();
        if (socket?.connected) {
          socket.emit('group:update', {
            groupId,
            name: groupName,
            description: groupDesc,
            icon: groupIcon,
          });
        }
      } catch { /* socket may not be connected */ }
    } catch (err) {
      console.error("Failed to update group:", err);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !groupId) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    setUploadingIcon(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/files/upload`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (!uploadRes.ok) throw new Error("Failed to upload icon");
      const fileData = await uploadRes.json();
      
      const iconUrl = `${process.env.NEXT_PUBLIC_API_URL}/files/${fileData.storageKey}`;
      setGroupIcon(iconUrl);
      
      // Auto-save the new icon if not currently in full edit mode
      if (!editing) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups/${groupId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ icon: iconUrl }),
        });
        if (group) setGroup({ ...group, icon: iconUrl });
        // Emit WebSocket event
        try {
          const socket = getSocket();
          if (socket?.connected) {
            socket.emit('group:update', { groupId, icon: iconUrl });
          }
        } catch { /* socket may not be connected */ }
      }
    } catch (err) {
      console.error("Icon upload failed:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploadingIcon(false);
      // Reset input
      e.target.value = "";
    }
  };

  const handleAddMember = async () => {
    if (!groupId || !newMemberEmail.trim()) return;
    setActionLoading("add");
    try {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/groups/${groupId}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email: newMemberEmail.trim() }),
        }
      );
      if (res.ok) {
        setNewMemberEmail("");
        setAddingMember(false);
        // Trigger re-fetch
        onOpenChange(false);
        setTimeout(() => onOpenChange(true), 100);
      }
    } catch (err) {
      console.error("Failed to add member:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromote = async (memberId: string) => {
    if (!groupId) return;
    setActionLoading(memberId);
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups/${groupId}/admins`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: memberId, action: "promote" }),
      });
      onOpenChange(false);
      setTimeout(() => onOpenChange(true), 100);
    } catch (err) {
      console.error("Failed to promote member:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDemote = async (memberId: string) => {
    if (!groupId) return;
    setActionLoading(memberId);
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups/${groupId}/admins`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: memberId, action: "demote" }),
      });
      onOpenChange(false);
      setTimeout(() => onOpenChange(true), 100);
    } catch (err) {
      console.error("Failed to demote member:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!groupId) return;
    setActionLoading(memberId);
    try {
      const token = await getToken();
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/groups/${groupId}/members/${memberId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      onOpenChange(false);
      setTimeout(() => onOpenChange(true), 100);
    } catch (err) {
      console.error("Failed to remove member:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const getInitials = (name: string) =>
    name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  const members = group?.members || [];
  const createdDate = group?.createdAt
    ? new Date(group.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] sm:w-[420px] p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Group Settings
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : !group ? (
            <div className="text-center text-xs text-muted-foreground py-12">
              Group not found
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Group Info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Group Info</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs rounded-full"
                    onClick={() => editing ? handleSaveEdit() : setEditing(true)}
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    {editing ? "Save" : "Edit"}
                  </Button>
                </div>

                <div className="flex items-start gap-4">
                  <div className="relative group/icon w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 border border-border/50">
                    <Avatar className="w-16 h-16 rounded-xl">
                      <AvatarImage src={groupIcon?.startsWith('http') ? groupIcon : undefined} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl rounded-xl">
                        {groupIcon && !groupIcon.startsWith('http') ? groupIcon : "👥"}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Upload Overlay */}
                    {(editing || getRole(group.members.find(m => group.creator._id === m._id || group.admins.some(a => a._id === m._id)) || Object() as any, group) !== "member") && (
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover/icon:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white">
                        {uploadingIcon ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-5 h-5 mb-1" />
                            <span className="text-[9px] font-medium uppercase tracking-wider">Change</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={handleIconUpload}
                              disabled={uploadingIcon}
                            />
                          </>
                        )}
                      </label>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    {editing ? (
                      <>
                        <Input
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          className="h-8 text-sm"
                        />
                        <Textarea
                          value={groupDesc}
                          onChange={(e) => setGroupDesc(e.target.value)}
                          className="resize-none h-16 text-xs"
                        />
                      </>
                    ) : (
                      <>
                        <h3 className="font-semibold">{group.name}</h3>
                        <p className="text-sm text-muted-foreground">{group.description || "No description"}</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 text-[11px] text-muted-foreground">
                  <Lock className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  End-to-end encrypted group {createdDate && `• Created ${createdDate}`}
                </div>
              </div>

              <Separator className="opacity-50" />

              {/* Members */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Members ({members.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs rounded-full text-primary"
                    onClick={() => setAddingMember(!addingMember)}
                  >
                    <UserPlus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>

                {addingMember && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex gap-2"
                  >
                    <Input
                      placeholder="Email address"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs px-3 rounded-full"
                      onClick={handleAddMember}
                      disabled={actionLoading === "add"}
                    >
                      {actionLoading === "add" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Mail className="w-3 h-3 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}

                <div className="space-y-1">
                  {members.map((member, i) => {
                    const role = getRole(member, group);
                    return (
                      <motion.div
                        key={member._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group"
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(member.displayName)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{member.displayName}</span>
                            {getRoleIcon(role)}
                            {getRoleBadge(role)}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                        </div>

                        {/* Actions (only for non-creator members) */}
                        {role !== "creator" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:bg-accent hover:text-accent-foreground">
                              <Settings className="w-3.5 h-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {role === "member" ? (
                                <DropdownMenuItem
                                  className="text-xs gap-2"
                                  onClick={() => handlePromote(member._id)}
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  Promote to Admin
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-xs gap-2"
                                  onClick={() => handleDemote(member._id)}
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  Demote to Member
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-xs gap-2 text-destructive focus:text-destructive"
                                onClick={() => handleRemoveMember(member._id)}
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                                Remove from Group
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <Separator className="opacity-50" />

              {/* Role Legend */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Roles</h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Crown className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
                    <div>
                      <span className="font-medium text-foreground">Creator</span> — Full control, cannot be removed
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="w-3.5 h-3.5 text-primary mt-0.5" />
                    <div>
                      <span className="font-medium text-foreground">Admin</span> — Can manage members and settings
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="font-medium text-foreground">Member</span> — Can send messages and files
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="opacity-50" />

              {/* Danger Zone */}
              <div>
                <Button
                  variant="outline"
                  className="w-full rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Leave Group
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
