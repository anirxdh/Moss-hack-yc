import { BackButton } from '@/components/app/back-button';

export default function UploadLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackButton href="/" />
      {children}
    </>
  );
}
