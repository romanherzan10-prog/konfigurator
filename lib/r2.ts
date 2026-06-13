import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 (S3-kompatibilní) — server-only upload helper.
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL.
 * Veřejná URL = R2_PUBLIC_URL (pub-…r2.dev), ne cloudflarestorage endpoint.
 */

let _r2: S3Client | null = null;

function client(): S3Client {
  if (_r2) return _r2;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Chybí R2 konfigurace (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)."
    );
  }
  _r2 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
    },
  });
  return _r2;
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicUrl) {
    throw new Error("Chybí R2_BUCKET nebo R2_PUBLIC_URL.");
  }
  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}
