import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Synapse Core — Brain & Muscle AI DevOps Platform",
  description: "Stateless Control Plane & Stateful Remote Execution Nodes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <body className="min-h-screen bg-nb-gray-950 text-nb-gray-100 antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
