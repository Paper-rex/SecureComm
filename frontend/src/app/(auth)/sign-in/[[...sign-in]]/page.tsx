import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl -translate-y-1/2 -translate-x-1/4" />
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            cardBox: "shadow-xl shadow-primary/5 border border-border/50",
          },
        }}
      />
    </div>
  );
}
