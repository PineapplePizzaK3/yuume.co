# Anti-Fraud System (Referral + Affiliate)

## 1) Layered architecture

1. **Validation Layer**
   - Server-side checks only.
   - Blocks self-referral, same email/phone referral, affiliate self-purchase.
2. **Device Fingerprinting**
   - Fingerprint built from IP, user-agent, device type, OS, timezone.
   - SHA-256 hash used for persistence and correlation.
3. **IP Analysis**
   - Counts accounts per IP in time window.
   - Tracks affiliate clicks/orders by IP.
   - Adds proxy heuristic flag.
4. **Behavior Analysis**
   - Signup-to-purchase delta.
   - Pages visited before conversion.
   - Repeated low-value order pattern.
5. **Risk Scoring Engine**
   - Weighted score + thresholds:
     - `< approve_max` => approve
     - `approve_max..review_max` => review/flag
     - `> review_max` => reject
6. **Reward Delay**
   - Rewards/commissions are held and released after delivery + configurable hold days.
7. **Limits & Rate Control**
   - Per-IP account limit window.
   - Referral monthly cap.
   - Affiliate daily conversion cap and commission cap before review.
8. **Manual Review**
   - Admin review queue for flagged/pending cases.
   - Admin decision endpoint to approve/reject/flag/pending.

## 2) Database changes

Migration: `supabase/migrations/065_anti_fraud_foundation.sql`

- Added anti-fraud config in `system_settings` (weights, thresholds, limits, hold days).
- Extended `profiles` with:
  - `last_login_ip`
  - `device_fingerprint`
- Added `fraud_logs` table.
- Extended `referrals` with:
  - `risk_score`, `fraud_flags`, `reward_release_at`, `reviewed_by`, `reviewed_at`
  - New status flow support: `pending, approved, rejected, flagged` (plus legacy statuses).
- Extended `affiliate_clicks` with:
  - `ip`, `device_fingerprint`, `risk_score`, `flags`
- Extended `affiliate_orders` with:
  - `risk_score`, `flags`, `reward_release_at`, `reviewed_by`, `reviewed_at`
  - New status flow support: `pending, approved, rejected, flagged` (plus legacy statuses).
- Added delayed referral release function:
  - `release_due_referral_rewards(p_limit)`
- Updated payout candidate generator:
  - `create_affiliate_payout_candidates()` now respects `reward_release_at`.

## 3) Backend implementation

### Shared anti-fraud engine

`server-lib/antiFraud.js`

- Auth helpers, admin check, IP extraction.
- Fingerprint generation.
- Risk config loader from `system_settings`.
- Risk evaluator (IP/fingerprint/behavior/geo/proxy signals).
- Fraud logging helper.
- User security metadata updater.

### API endpoints

- `POST /api/referral/apply`
  - Validates referral code and anti-abuse rules.
  - Computes risk score.
  - Writes referral as `pending/flagged/rejected`.
- `POST /api/affiliate/track-click`
  - Tracks click with risk metadata and fingerprint/IP.
- `POST /api/affiliate/track-order`
  - Validates ownership and self-purchase.
  - Computes risk + applies limits.
  - Writes affiliate order as `pending/flagged/rejected`.
  - Sets delayed release timestamp when eligible.
- `GET /api/admin/fraud/review`
  - Admin-only queue for referral and affiliate suspicious cases + logs.
- `POST /api/admin/fraud/decision`
  - Admin-only status decision (`approve/reject/flag/pending`) for referrals/affiliate orders.

## 4) Risk model

`risk_score = sum(weighted_flags)`

Current weighted flags (configurable):
- same IP burst
- same fingerprint across multiple accounts
- fast purchase after signup
- no browsing
- geo mismatch
- proxy heuristic
- repeated low-value pattern

## 5) Security notes

- No frontend-trusted fraud decision; all decisions made server-side.
- Endpoint auth required where needed.
- Admin endpoints verify role in `profiles.role`.
- Affiliate/referral code validation performed server-side.
- Logs written to `fraud_logs` for auditability.

## 6) Example test cases

1. **Legit referral**
   - Different user/device/IP.
   - Risk score < approve threshold.
   - Referral status => `pending` then `approved/rewarded` after delay pipeline.

2. **Fraud referral (same IP + same fingerprint)**
   - Multiple accounts same device and IP window.
   - Risk score > review/reject threshold.
   - Status => `flagged` or `rejected`.

3. **Affiliate self-purchase**
   - Buyer is affiliate owner.
   - Commission blocked.
   - `affiliate_orders.status = rejected`.

4. **High-risk affiliate conversion**
   - Fast purchase + no browsing + proxy hint + geo mismatch.
   - Score above threshold.
   - Status => `flagged` and requires admin decision.

## 7) Operational rollout

1. Apply migration `065`.
2. Deploy API functions under `/api`.
3. Route frontend calls to the new endpoints.
4. Add scheduled job (cron) to run:
   - `SELECT public.release_due_referral_rewards(500);`
   - `SELECT public.create_affiliate_payout_candidates();`
