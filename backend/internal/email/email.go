package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type Client struct {
	apiKey string
	from   string
}

func New() *Client {
	from := os.Getenv("EMAIL_FROM")
	if from == "" {
		from = "Cobalt <onboarding@resend.dev>"
	}
	return &Client{
		apiKey: os.Getenv("RESEND_API_KEY"),
		from:   from,
	}
}

func (c *Client) Enabled() bool {
	return c.apiKey != ""
}

func (c *Client) SendInvite(to, inviteURL string) error {
	if !c.Enabled() {
		return nil
	}

	payload := map[string]any{
		"from":    c.from,
		"to":      []string{to},
		"subject": "You've been invited to join Cobalt",
		"html":    inviteEmailHTML(inviteURL),
	}

	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("resend returned status %d", resp.StatusCode)
	}
	return nil
}

func inviteEmailHTML(inviteURL string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Helvetica,Arial,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#172554;padding:32px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">Cobalt</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#0f172a;">You're invited to Cobalt</h1>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6;">
              A team admin has invited you to join their workspace on Cobalt Time Tracker.
              Click the button below to accept the invitation and create your account.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background:#2563eb;">
                  <a href="%s" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                    Accept Invitation
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;">
              Or copy this link into your browser:<br>
              <a href="%s" style="color:#2563eb;word-break:break-all;">%s</a>
            </p>
            <p style="margin:20px 0 0;font-size:12px;color:#cbd5e1;">This invite link expires in 7 days.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f1f5f9;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Cobalt Time Tracker · If you weren't expecting this, you can ignore this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, inviteURL, inviteURL, inviteURL)
}
