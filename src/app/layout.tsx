import type { Metadata } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import { MotionOrchestrator } from "@/app/components/motion-orchestrator";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Daylight | Personal command center",
  description: "A calm personal dashboard for your tasks, schedule, habits, notes, and projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var theme=localStorage.getItem("daylight-theme");if(theme!=="light"&&theme!=="dark"){theme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(error){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <MotionOrchestrator>{children}</MotionOrchestrator>
      </body>
    </html>
  );
}
