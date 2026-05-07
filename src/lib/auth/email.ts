export interface InviteEmailParams {
  to: string
  locationName: string
  inviterName: string
  token: string
  baseUrl: string
  apiKey: string
}

export interface EmailResult {
  id: string
}

export async function sendInvitationEmail(params: InviteEmailParams): Promise<EmailResult> {
  const { to, locationName, inviterName, token, baseUrl, apiKey } = params
  const inviteUrl = `${baseUrl}/invite/${token}`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Restoraunch <no-reply@sahil.pro>',
      to,
      subject: `You're invited to join ${locationName} on Restoraunch`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a;">You're Invited!</h1>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
            ${inviterName} has invited you to join <strong>${locationName}</strong> on Restoraunch.
          </p>
          <p style="margin: 32px 0;">
            <a href="${inviteUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: 500;">
              Accept Invitation
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            This invitation expires in 7 days. If you didn't expect this, you can ignore this email.
          </p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Resend API error: ${JSON.stringify(error)}`)
  }

  return response.json()
}
