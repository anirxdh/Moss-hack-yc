import { BackButton } from '@/components/app/back-button';

export default function ReturnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackButton href="/upload" />
      {children}
    </>
  );
}
