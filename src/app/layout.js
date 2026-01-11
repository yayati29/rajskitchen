import { Playfair_Display, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const playfair = Playfair_Display({
  weight: ['400', '500', '600', '700'],
  subsets: ["latin"],
  variable: '--font-heading',
});

const grotesk = Space_Grotesk({
  weight: ['400', '500', '600', '700'],
  subsets: ["latin"],
  variable: '--font-body',
});

export const metadata = {
  title: "Raj's Kitchen - Cloud Kitchen",
  description: "Authentic homemade meals delivered fresh to your door",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${grotesk.variable}`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
