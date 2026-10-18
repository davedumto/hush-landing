import type { Metadata } from "next";
import { Fredoka, Nunito, Fraunces, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const fDisp = Fredoka({
  variable: "--f-disp",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const fBody = Nunito({
  variable: "--f-body",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

const fItal = Fraunces({
  variable: "--f-ital",
  weight: ["400", "500"],
  style: ["italic"],
  subsets: ["latin"],
});

const fMono = IBM_Plex_Mono({
  variable: "--f-mono",
  weight: ["500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "hush.",
  description:
    "hush. puts noise control for your JBL Tune 770NC and 670NC one click from the edge of your Mac.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${fDisp.variable} ${fBody.variable} ${fItal.variable} ${fMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
