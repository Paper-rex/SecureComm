"use client";

import { motion } from "framer-motion";
import { Shield, Lock, MessageSquare } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md"
      >
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Shield className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Welcome to SecureComm</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Select a conversation from the sidebar or search for a user by email to start a secure, encrypted chat.
        </p>
        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
          <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border/50">
            <Lock className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground">E2E Encrypted</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border/50">
            <MessageSquare className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground">Real-Time Chat</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
