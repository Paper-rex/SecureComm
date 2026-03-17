"use client";

import { useAuth, useUser, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Moon, Sun, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { Sidebar } from "@/components/chat/sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const syncedRef = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  // Sync user profile to MongoDB on first login
  useEffect(() => {
    if (!isSignedIn || !user || syncedRef.current) return;
    syncedRef.current = true;

    const syncUser = async () => {
      try {
        const token = await getToken();
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: user.primaryEmailAddress?.emailAddress || "",
            displayName: user.fullName || user.firstName || "User",
            profilePicture: user.imageUrl || "",
            publicKey: "placeholder-key-" + Date.now(),
          }),
        });
        console.log("User synced to MongoDB (online)");
      } catch (err) {
        console.error("Failed to sync user:", err);
      }
    };

    syncUser();
  }, [isSignedIn, user, getToken]);

  // Set user offline when browser tab closes
  useEffect(() => {
    if (!isSignedIn) return;

    const handleOffline = async () => {
      try {
        const token = await getToken();
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "offline" }),
          keepalive: true,
        });
      } catch {
        // Best effort
      }
    };

    window.addEventListener("beforeunload", handleOffline);
    return () => window.removeEventListener("beforeunload", handleOffline);
  }, [isSignedIn, getToken]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Shield className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-border/50 flex items-center justify-between px-4 bg-card/50 backdrop-blur-lg flex-shrink-0 z-50">
        <div className="flex items-center gap-3">
          {/* Mobile menu */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger className="inline-flex items-center justify-center rounded-md h-9 w-9 hover:bg-accent hover:text-accent-foreground lg:hidden">
              <Menu className="w-5 h-5" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[320px]">
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-base hidden sm:inline">SecureComm</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-full"
            >
              <AnimatePresence mode="wait">
                {theme === "dark" ? (
                  <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                    <Sun className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                    <Moon className="w-4 h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          )}
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              },
            }}
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-[340px] xl:w-[380px] border-r border-border/50 flex-shrink-0">
          <Sidebar />
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
