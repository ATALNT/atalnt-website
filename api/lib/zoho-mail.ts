// ============================================
// Zoho Mail API — Send email as nik@atalnt.com
// Uses admin@atalnt.com account with nik@atalnt.com as Send As alias
// ============================================

interface ZohoMailAccount {
  accountId: string;
  emailAddress: string[];
  sendMailDetails?: { fromAddress: string }[];
}

let cachedAccountId: string | null = null;

async function getMailAccountId(accessToken: string): Promise<string> {
  if (cachedAccountId) return cachedAccountId;

  const resp = await fetch('https://mail.zoho.com/api/accounts', {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Zoho Mail accounts API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const accounts = data.data || [];
  if (accounts.length === 0) throw new Error('No Zoho Mail accounts found');

  cachedAccountId = accounts[0].accountId;
  return cachedAccountId!;
}

export async function sendEmailAsNik(
  accessToken: string,
  toAddress: string,
  subject: string,
  htmlContent: string,
  ccAddress?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const accountId = await getMailAccountId(accessToken);

    const body: Record<string, any> = {
      fromAddress: 'nik@atalnt.com',
      toAddress,
      subject,
      content: htmlContent,
      mailFormat: 'html',
    };
    if (ccAddress) body.ccAddress = ccAddress;

    const resp = await fetch(
      `https://mail.zoho.com/api/accounts/${accountId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return { success: false, error: `${resp.status}: ${errText}` };
    }

    const result = await resp.json();
    return { success: true, messageId: result.data?.messageId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
