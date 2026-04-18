import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Auth Dashboard",
  description: "Login superuser dengan Prisma + MySQL",
};

export default function RootLayout({ children }) {

  const developmentMode = String(process.env.DEVELOPMENT_MODE || "true").trim().toLowerCase() !== "false";
  if (developmentMode) {
    return (
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <span className="fixed -right-32 top-10 z-50 bg-red-500 h-fit w-96 p-4 items-center text-sm text-white font-bold flex justify-center rotate-45">
            DEVELOPMENT MODE
          </span>
            {children}
        </body>
      </html>
    );
  } 

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
