#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Provision the AI-CPA document-upload S3 bucket. Idempotent — safe to re-run.
#
# Creates: bucket + block-public-access + default SSE + CORS (presigned POST/PUT
# from the frontend origin) + lifecycle (expire raw uploads). Prints an IAM
# least-privilege policy you can attach later (for deploy); local dev uses the
# SSO profile directly, so no IAM user is created here.
#
# Usage:
#   AWS_PROFILE=moss-hackathon ./infra/s3-setup.sh
#   # or override any of:
#   AWS_PROFILE=moss-hackathon BUCKET=moss-yc-hackathon-docs REGION=us-west-2 \
#     FRONTEND_ORIGIN=http://localhost:3000 ./infra/s3-setup.sh
# ---------------------------------------------------------------------------
set -euo pipefail

BUCKET="${BUCKET:-moss-yc-hackathon-docs}"
REGION="${REGION:-us-west-2}"
EXPECTED_ACCOUNT="${EXPECTED_ACCOUNT:-563683519291}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:3000}"
PROFILE_FLAG=""
[ -n "${AWS_PROFILE:-}" ] && PROFILE_FLAG="--profile ${AWS_PROFILE}"

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }

# --- 0. Verify we're pointed at the right account ----------------------------
say "Verifying identity (account must be ${EXPECTED_ACCOUNT})"
CALLER="$(aws sts get-caller-identity ${PROFILE_FLAG} --output json)"
ACCOUNT="$(printf '%s' "$CALLER" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Account"])')"
echo "  authenticated as: $(printf '%s' "$CALLER" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Arn"])')"
if [ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]; then
  echo "  ERROR: wrong account ($ACCOUNT). Expected ${EXPECTED_ACCOUNT}. Aborting." >&2
  exit 1
fi
echo "  account OK: $ACCOUNT"

# --- 1. Create the bucket (idempotent) ---------------------------------------
say "Creating bucket s3://${BUCKET} in ${REGION}"
if aws s3api head-bucket --bucket "$BUCKET" ${PROFILE_FLAG} 2>/dev/null; then
  echo "  bucket already exists — skipping create"
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" ${PROFILE_FLAG}
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" ${PROFILE_FLAG} \
      --create-bucket-configuration "LocationConstraint=${REGION}"
  fi
  echo "  created"
fi

# --- 2. Block ALL public access ---------------------------------------------
say "Blocking public access"
aws s3api put-public-access-block --bucket "$BUCKET" ${PROFILE_FLAG} \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# --- 3. Default server-side encryption --------------------------------------
say "Enabling default SSE (AES256)"
aws s3api put-bucket-encryption --bucket "$BUCKET" ${PROFILE_FLAG} \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# --- 4. CORS — presigned POST/PUT from the frontend origin only --------------
say "Setting CORS for origin ${FRONTEND_ORIGIN}"
aws s3api put-bucket-cors --bucket "$BUCKET" ${PROFILE_FLAG} --cors-configuration "{
  \"CORSRules\":[{
    \"AllowedOrigins\":[\"${FRONTEND_ORIGIN}\"],
    \"AllowedMethods\":[\"POST\",\"PUT\"],
    \"AllowedHeaders\":[\"*\"],
    \"ExposeHeaders\":[\"ETag\"],
    \"MaxAgeSeconds\":3000
  }]
}"

# --- 5. Lifecycle — expire raw uploads after 30 days -------------------------
# Docs live in Moss after ingest; S3 is the durable source-of-record, but raw
# uploads under users/ don't need to live forever for a hackathon.
say "Setting lifecycle (expire users/* after 30 days)"
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" ${PROFILE_FLAG} \
  --lifecycle-configuration '{
    "Rules":[{
      "ID":"expire-raw-uploads",
      "Status":"Enabled",
      "Filter":{"Prefix":"users/"},
      "Expiration":{"Days":30}
    }]
  }'

# --- 6. Print the least-privilege IAM policy (for later deploy) ---------------
say "Least-privilege IAM policy (attach to deploy principals — not needed for local SSO dev)"
cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PresignerPutOnly",
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::${BUCKET}/users/*"
    },
    {
      "Sid": "IngesterGetOnly",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::${BUCKET}/users/*"
    }
  ]
}
JSON

say "Done. Bucket s3://${BUCKET} is ready (objects go under users/{clerkUserId}/...)."
