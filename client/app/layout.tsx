import './globals.css';
import { Roboto } from 'next/font/google';
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from 'sonner';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-roboto',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={roboto.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="subtle-gradient min-h-screen">
            <Toaster />
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}

