import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    template: 'Dovin Pratama | %s',
  },
  description: "Dashboard operasional internal PT. Dovin Pratama. Akses terbatas untuk pengguna terdaftar sesuai peran dan izin yang diberikan.",
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
          <PwaRegister />
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
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
