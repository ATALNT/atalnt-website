// ============================================
// Zoho CRM API — Create Leads
// ============================================

interface CrmLeadData {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  leadSource?: string;
  description?: string;
}

export async function createCrmLead(
  accessToken: string,
  lead: CrmLeadData
): Promise<{ success: boolean; leadId?: string; error?: string }> {
  try {
    const body = {
      data: [
        {
          First_Name: lead.firstName,
          Last_Name: lead.lastName || 'Unknown',
          Email: lead.email,
          Company: lead.company || 'Unknown',
          Lead_Source: lead.leadSource || 'Instantly Outbound',
          Description: lead.description || '',
        },
      ],
      trigger: ['workflow'],
    };

    const resp = await fetch('https://www.zohoapis.com/crm/v2/Leads', {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { success: false, error: `${resp.status}: ${errText}` };
    }

    const result = await resp.json();
    const created = result.data?.[0];
    if (created?.code === 'SUCCESS') {
      return { success: true, leadId: created.details?.id };
    }

    return { success: false, error: created?.message || 'Unknown CRM error' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function checkDuplicateLead(
  accessToken: string,
  email: string
): Promise<boolean> {
  try {
    const resp = await fetch(
      `https://www.zohoapis.com/crm/v2/Leads/search?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      }
    );

    if (!resp.ok) return false; // Treat errors as "not found" to avoid blocking
    const result = await resp.json();
    return (result.data?.length || 0) > 0;
  } catch {
    return false;
  }
}
