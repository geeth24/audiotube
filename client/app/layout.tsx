import './globals.css';
import { Lato } from 'next/font/google';
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from 'sonner';

const lato = Lato({
  subsets: ['latin'],
  weight: ['100', '300', '400', '700', '900'],
});
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={lato.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Toaster />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

