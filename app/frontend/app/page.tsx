import { headers } from 'next/headers';
import { LandingView } from '@/components/app/landing-view';
import { getAppConfig } from '@/lib/utils';

export default async function Page() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return <LandingView companyName={appConfig.companyName} />;
}
