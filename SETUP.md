# SETUP — Jerom's runbook

Everything Claude could not do for you: AWS account bits, Vercel deployment, and the
Devpost registration. Local dev needs none of this (see README quick start).

> **Deadlines:** AWS/v0 credits request form closes **June 26, 12:00 PM PT**.
> Submission closes **June 29, 5:00 PM PDT**. Don't submit on the last day.

## 0. Register (do this first)

1. Register on Devpost: https://h01.devpost.com/ → "Join hackathon".
2. Request the free credits ($100 AWS + $30 v0) via the form linked on
   https://h01.devpost.com/resources → https://forms.gle/ozhbhvaXAxHxu3kMA
   (deadline June 26, 12pm PT — do it today).

## 1. AWS: one table, one IAM user (~15 minutes)

1. Sign in / create an AWS account → https://console.aws.amazon.com/
2. Pick region **us-east-1** (or any one region — just be consistent).
3. Create an IAM user for the app (Console → IAM → Users → Create user):
   - Name: `zerodrop-app`. No console access needed.
   - Permissions → "Attach policies directly" → create an **inline policy** (JSON):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
           "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:DescribeTable"
         ],
         "Resource": [
           "arn:aws:dynamodb:*:*:table/zerodrop",
           "arn:aws:dynamodb:*:*:table/zerodrop/index/*"
         ]
       }
     ]
   }
   ```

   - After creating the user: Security credentials → **Create access key** →
     "Application running outside AWS" → save the key id + secret.

4. Create the table + seed demo data from your machine (PowerShell):

   ```powershell
   $env:ZD_AWS_REGION = "us-east-1"
   $env:ZD_AWS_ACCESS_KEY_ID = "AKIA..."        # an ADMIN or table-create-capable key
   $env:ZD_AWS_SECRET_ACCESS_KEY = "..."
   $env:DDB_TABLE = "zerodrop"
   npm run db:seed:aws
   ```

   Note: `CreateTable`/`UpdateTimeToLive` need broader permissions than the app policy
   above — run the seed with your admin credentials once, then use the limited
   `zerodrop-app` key in Vercel. (TTL gets enabled on attribute `ttl` automatically.)

5. **Screenshot for the submission:** AWS Console → DynamoDB → Tables → `zerodrop` →
   "Explore table items" (shows DROP/CLAIM items) and the **Monitor** tab after you run
   a stress test (shows real write traffic). Both make great proof shots.

## 2. Vercel deployment (~10 minutes)

1. Push is already done — repo: `jeromtom/h0-zero-stack` (keep it private; judges get
   the deployed link + test credentials, not the repo).
2. https://vercel.com → Add New → Project → import `h0-zero-stack`. Framework:
   Next.js (auto-detected). No build changes needed.
3. Project → Settings → **Environment Variables** (Production + Preview):

   | Name | Value |
   |---|---|
   | `ZD_AWS_REGION` | `us-east-1` |
   | `ZD_AWS_ACCESS_KEY_ID` | the `zerodrop-app` key id |
   | `ZD_AWS_SECRET_ACCESS_KEY` | the `zerodrop-app` secret |
   | `DDB_TABLE` | `zerodrop` |
   | `SESSION_SECRET` | output of `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

   Do **not** set `DYNAMODB_ENDPOINT` on Vercel (that's the local-emulator switch).
   The `AWS_*` names are reserved by Vercel — that's why the app reads `ZD_AWS_*`.

4. Deploy. Smoke test the production URL:
   - `/` shows the live AURA-1 drop card (proves DB connectivity)
   - log in with `demo@zerodrop.app / drop-zero-2026`
   - run a 250-buyer stress test; watch DynamoDB metrics light up in the AWS console
5. **Vercel Team ID** (required by Devpost): Vercel → Team → Settings → General →
   copy the Team ID.

## 3. Devpost submission checklist

- [ ] Published Vercel URL
- [ ] Vercel Team ID
- [ ] Database used: **DynamoDB**
- [ ] Test credentials: `demo@zerodrop.app / drop-zero-2026`
- [ ] Text description (crib from README + PLAN.md "Why this can win")
- [ ] Architecture diagram: recreate the README mermaid chart in draw.io/Excalidraw,
      export PNG (organizers want labeled boxes + directional arrows)
- [ ] Screenshot of DynamoDB console (step 1.5)
- [ ] Demo video < 3 min on YouTube (see DEMO_SCRIPT.md), publicly visible
- [ ] Optional +0.6 pts: up to 3 posts (Dev.to / LinkedIn / builder.aws.com) tagged
      **#H0Hackathon**, each stating it was created for the hackathon

## Notes

- Node 18.18+ required locally (this machine has v26 — fine).
- Costs: DynamoDB on-demand for this app is effectively $0 (well within free tier /
  the $100 credits). A 1,000-buyer stress test is ~2,000 write units ≈ $0.0025.
- If you re-record the demo, hit **Reset demo** on the drop admin page to restore the
  AURA-1 drop to 0/100.
- Re-running `npm run db:seed:aws` is safe — it resets the seeded items in place.

## Claude in Chrome runbook (paste this into Claude in Chrome)

> You are helping Jerom register for the H0 hackathon. My details: name **Jerom Tom**, email **dev.jeromtom@gmail.com**, GitHub **jeromtom**, country India. Rules: never invent data — if a form asks something not listed here, stop and ask me. Stop for all captchas, OTPs, and password entries — I'll do those. Do NOT click any final competition "Submit project" button; registration only.
>
> 1. Go to https://h01.devpost.com/ and click "Join hackathon". Sign in to Devpost with my email (I'll enter the password/OTP). Complete the registration questions (solo participant, individual).
> 2. On the hackathon page, find the **AWS credits request form** (mentioned in the rules/updates — deadline Jun 26, 12 PM PT) and fill it with my details.
> 3. Go to https://signin.aws.amazon.com/ → "Create a new AWS account" with my email. Pause for me at payment-card and phone-verification steps.
> 4. After AWS account exists: open IAM → create user `zerodrop-app` with programmatic access, attach the inline policy I'll paste from SETUP.md step 2, and show me the access key pair so I can copy it into `.env`.
> 5. Go to https://vercel.com/signup → "Continue with GitHub" as jeromtom → after login, open Team Settings and read me the **Team ID** (needed for Devpost submission).
