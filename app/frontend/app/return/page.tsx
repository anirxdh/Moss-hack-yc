import { headers } from 'next/headers';
import { ReturnApp } from '@/components/app/return-app';
import { getAppConfig } from '@/lib/utils';

export default async function ReturnPage() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return <ReturnApp appConfig={appConfig} />;
}
