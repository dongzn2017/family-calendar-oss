# Optional Gmail Sync via Google Apps Script

Because external servers accessing Gmail API face 7-day OAuth refresh token expiry in testing mode, you can optionally run [`Code.gs`](./Code.gs) inside your own Google Apps Script account (free, no credit card, never expires).

## Setup
1. Open [script.google.com](https://script.google.com) and create a new project.
2. Paste `gas/Code.gs` and customize `MAIL_RULES` with your own trusted senders or domains.
3. Open **Project Settings → Script Properties** and add:
   - `FAMILYCAL_ENDPOINT`: `https://<your-domain>/api/ingest/gmail`
   - `FAMILYCAL_SECRET`: same random secret stored in Cloudflare Worker Secret `GMAIL_INGEST_SECRET`
4. Run `dryRunTest()` manually first to verify matches in logs.
5. Add a time-driven trigger for `syncSelectedEmails()` (e.g. daily at 21:00).
6. If using Cloudflare Access, add a Bypass policy for the `/api/ingest/gmail` path (protected by `X-FamilyCal-Secret`).
