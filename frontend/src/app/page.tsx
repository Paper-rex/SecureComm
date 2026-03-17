"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, MessageSquare, Users, FileKey, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Lock, title: "End-to-End Encryption", desc: "AES-256 + RSA-4096 ensures only you and your recipient can read messages" },
  { icon: MessageSquare, title: "Real-Time Messaging", desc: "Instant communication powered by WebSockets with delivery confirmations" },
  { icon: Users, title: "Secure Group Chats", desc: "Create groups with role-based access control and encrypted conversations" },
  { icon: FileKey, title: "Encrypted File Sharing", desc: "Files encrypted client-side before upload — server never sees your data" },
  { icon: Shield, title: "Cyber Protection", desc: "Rate limiting, XSS/CSRF protection, malware scanning, and intrusion detection" },
  { icon: Zap, title: "Modern Experience", desc: "Clean, responsive UI following HCI principles with dark/light mode support" },
];

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) router.push("/dashboard");
  }, [isSignedIn, router]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary/10 blur-3xl translate-y-1/2 -translate-x-1/4" />

        <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-4 border-b border-border/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">SecureComm</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <Button variant="ghost" onClick={() => router.push("/sign-in")}>
              Sign In
            </Button>
            <Button onClick={() => router.push("/sign-up")} className="rounded-full px-6">
              Get Started
            </Button>
          </motion.div>
        </nav>

        <div className="relative z-10 flex flex-col items-center text-center px-6 py-24 lg:py-36">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-sm text-primary font-medium mb-8">
              <Lock className="w-3.5 h-3.5" />
              End-to-End Encrypted
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl leading-[1.1]"
          >
            Communication that&apos;s{" "}
            <span className="text-primary">truly</span> private
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mt-6"
          >
            SecureComm delivers military-grade encryption for your messages and files.
            No one — not even us — can read your conversations.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 mt-10"
          >
            <Button size="lg" onClick={() => router.push("/sign-up")} className="rounded-full px-8 text-base h-12">
              Start Messaging Securely
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 text-base h-12">
              Learn More
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="grid grid-cols-3 gap-8 md:gap-16 mt-20 pt-10 border-t border-border/50"
          >
            {[
              { value: "AES-256", label: "Encryption" },
              { value: "RSA-4096", label: "Key Exchange" },
              { value: "Zero", label: "Knowledge" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Features Grid */}
      <section className="px-6 lg:px-12 py-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold">Security meets simplicity</h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            Built with cybersecurity best practices, designed for everyday use.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="group relative p-6 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 lg:px-12 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-semibold">SecureComm</span>
          </div>
          <p className="text-sm text-muted-foreground mt-4 md:mt-0">
            © 2026 SecureComm. Built with security-first architecture.
          </p>
        </div>
      </footer>
    </div>
  );
}
