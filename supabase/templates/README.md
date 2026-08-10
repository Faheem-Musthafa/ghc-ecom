# Glockery Supabase Auth Email Templates

These files are the source of truth for the hosted Supabase Auth templates.

| Supabase template | Subject | Source file |
| --- | --- | --- |
| Confirm signup | `Welcome to Glockery — confirm your email` | `confirmation.html` |
| Reset password | `Reset your Glockery password` | `recovery.html` |

For the hosted production project:

1. Open **Supabase Dashboard → Authentication → Email Templates** and select
   **Set up SMTP**. Hosted Supabase requires custom SMTP before subjects and bodies can
   be edited.
2. Configure Resend SMTP with host `smtp.resend.com`, port `465`, username `resend`,
   the Resend API key as password, and a sender address on the verified Glockery domain.
   This SMTP connection originates from Supabase—not Railway.
3. Select **Confirm signup**, paste `confirmation.html`, and set its subject above.
4. Select **Reset password**, paste `recovery.html`, and set its subject above.
5. Save each template and send fresh signup and recovery messages to test them.
6. Keep email-provider link tracking disabled so `{{ .ConfirmationURL }}` is not rewritten.

The templates intentionally retain `{{ .ConfirmationURL }}` because the current frontend
consumes Supabase's confirmation and recovery redirects. Existing emails keep their old
content; only newly generated messages use saved template changes.
