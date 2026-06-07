import { Public_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import { ThemeProvider } from '@/components/app/theme-provider';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { cn } from '@/lib/shadcn/utils';
import { getAppConfig, getStyles } from '@/lib/utils';
import '@/styles/globals.css';

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

const commitMono = localFont({
  display: 'swap',
  variable: '--font-commit-mono',
  src: [
    {
      path: '../fonts/CommitMono-400-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-700-Regular.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-400-Italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../fonts/CommitMono-700-Italic.otf',
      weight: '700',
      style: 'italic',
    },
  ],
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  const styles = getStyles(appConfig);
  const { pageTitle, pageDescription } = appConfig;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        publicSans.variable,
        commitMono.variable,
        'scroll-smooth font-sans antialiased'
      )}
    >
      <head>
        {styles && <style>{styles}</style>}
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </head>
      <body className="overflow-x-hidden">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <header className="fixed top-0 left-0 z-50 flex w-full flex-row items-center justify-between p-6">
              <span className="text-foreground hidden font-mono text-xs font-bold tracking-wider uppercase md:inline">
                Built with{' '}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://docs.livekit.io/agents"
                  className="underline underline-offset-4"
                >
                  LiveKit Agents
                </a>
              </span>
              <div className="ml-auto flex items-center gap-3">
                <Show when="signed-out">
                  {/* After auth from anywhere (incl. the landing header), land on
                      the document-upload flow — Home → sign in/up → /upload. */}
                  <SignInButton mode="modal" forceRedirectUrl="/upload">
                    <button className="text-foreground font-mono text-xs font-bold tracking-wider uppercase underline-offset-4 hover:underline">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal" forceRedirectUrl="/upload">
                    <button className="bg-primary text-primary-foreground rounded-full px-4 py-1.5 font-mono text-xs font-bold tracking-wider uppercase">
                      Sign up
                    </button>
                  </SignUpButton>
                </Show>
                <Show when="signed-in">
                  <UserButton />
                </Show>
              </div>
            </header>

            {children}
            <div className="group fixed bottom-0 left-1/2 z-50 mb-2 -translate-x-1/2">
              <ThemeToggle className="translate-y-20 transition-transform delay-150 duration-300 group-hover:translate-y-0" />
            </div>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
