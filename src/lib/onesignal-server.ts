type OneSignalNotificationParams = {
  externalUserIds: string[];
  title: string;
  body: string;
  launchUrl?: string;
  data?: Record<string, any>;
};

export async function sendOneSignalNotification(params: OneSignalNotificationParams): Promise<{ id?: string } | null> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) return null;

  const externalUserIds = Array.from(new Set((params.externalUserIds ?? []).filter((x) => typeof x === 'string' && x)));
  if (externalUserIds.length === 0) return null;

  const payload: any = {
    app_id: appId,
    include_external_user_ids: externalUserIds,
    headings: { en: params.title, es: params.title },
    contents: { en: params.body, es: params.body },
  };

  const baseUrlRaw = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.APP_BASE_URL ?? 'https://agendo.nativatech.com.py';
  const baseUrl = typeof baseUrlRaw === 'string' ? baseUrlRaw.replace(/\/+$/, '') : 'https://agendo.nativatech.com.py';
  payload.large_icon = `${baseUrl}/icons/icon-192.png`;

  if (params.launchUrl) payload.url = params.launchUrl;
  if (params.data && typeof params.data === 'object') payload.data = params.data;

  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OneSignal error ${res.status}: ${txt}`);
  }

  const json: any = await res.json().catch(() => null);
  if (!json) return null;
  return { id: json.id as string | undefined };
}
