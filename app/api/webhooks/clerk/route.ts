import { NextResponse } from "next/server";
import { Webhook } from "svix";
import prisma from "@/lib/prisma";

// 🚀 This route handles incoming webhooks from Clerk to sync user data with our database
// without ngrok this won't hit database.
//

console.log("🚀 [CLERK-WEBHOOK] Module loaded - webhook route initialized");

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkPhoneNumber = {
  phone_number: string;
};

type ClerkUserData = {
  id?: string;
  email_addresses?: ClerkEmailAddress[];
  first_name?: string | null;
  last_name?: string | null;
  phone_numbers?: ClerkPhoneNumber[];
  primary_email_address_id?: string | null;
};

type ClerkWebhookEvent = {
  type: string;
  data: ClerkUserData;
};

export async function POST(req: Request) {
  const logPrefix = "[clerk-webhook]";
  const requestTimestamp = new Date().toISOString();
  
  // 🔴 CRITICAL: This should appear IMMEDIATELY when webhook is called
  console.log("🔴🔴🔴 WEBHOOK ENDPOINT HIT! 🔴🔴🔴");
  console.log(`${logPrefix} phase=request_received method=${req.method} timestamp=${requestTimestamp}`);

  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  console.log(`${logPrefix} CLERK_WEBHOOK_SECRET=${webhookSecret ? `✅ LOADED (${webhookSecret.substring(0, 10)}...)` : "❌ NOT SET"}`);
  console.log(`${logPrefix} All env vars loaded: CLERK_WEBHOOK_SECRET=${!!process.env.CLERK_WEBHOOK_SECRET}, NODE_ENV=${process.env.NODE_ENV}`);
  
  if (!webhookSecret) {
    console.error(`${logPrefix} ❌ FATAL: phase=config_error missing=CLERK_WEBHOOK_SECRET timestamp=${requestTimestamp}`);
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }
  console.log(`${logPrefix} phase=webhook_secret_loaded status=present timestamp=${requestTimestamp}`);

  const payload = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  console.log(
    `${logPrefix} phase=request_parsed payload_bytes=${payload.length} svix_id=${svixId} svix_timestamp=${svixTimestamp} svix_signature=${svixSignature ? "present" : "missing"} timestamp=${requestTimestamp}`,
  );

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error(`${logPrefix} phase=header_validation status=failed reason=missing_svix_headers svixId=${Boolean(svixId)} svixTimestamp=${Boolean(svixTimestamp)} svixSignature=${Boolean(svixSignature)} timestamp=${requestTimestamp}`);
    return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
  }

  const wh = new Webhook(webhookSecret);
  console.log(`${logPrefix} phase=verify_started svix_id=${svixId} svix_timestamp=${svixTimestamp} timestamp=${requestTimestamp}`);

  let event: ClerkWebhookEvent;

  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
    console.log(`${logPrefix} phase=verify_success type=${event.type} timestamp=${requestTimestamp}`);
    console.log(`${logPrefix} phase=event_data event=${JSON.stringify(event).substring(0, 500)}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`${logPrefix} phase=verify_failed error=${errorMsg} stack=${err instanceof Error ? err.stack : "no-stack"} timestamp=${requestTimestamp}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    console.log(`${logPrefix} phase=handle_user_upsert type=${event.type} timestamp=${requestTimestamp}`);
    const {
      id,
      email_addresses,
      first_name,
      last_name,
      phone_numbers,
      primary_email_address_id,
    } = event.data;

    console.log(`${logPrefix} phase=extract_user_data clerk_id=${id} email_count=${email_addresses?.length || 0} primary_email_id=${primary_email_address_id} first_name=${first_name} last_name=${last_name} phone_count=${phone_numbers?.length || 0} timestamp=${requestTimestamp}`);

    const primaryEmail =
      email_addresses?.find((email) => email.id === primary_email_address_id)?.email_address ??
      email_addresses?.[0]?.email_address;

    if (!id) {
      console.error(
        `${logPrefix} phase=user_payload_validation status=failed has_id=${Boolean(id)} timestamp=${requestTimestamp}`,
      );
      return NextResponse.json({ error: "Missing required user data in webhook payload" }, { status: 400 });
    }

    const fullName = [first_name, last_name].filter(Boolean).join(" ").trim() || "Unknown User";
    const phone = phone_numbers?.[0]?.phone_number ?? "";
    const resolvedEmail = primaryEmail ?? `${id}@clerk.local`;

    if (!primaryEmail) {
      console.warn(
        `${logPrefix} phase=user_payload_warning reason=missing_email fallback_email=${resolvedEmail} timestamp=${requestTimestamp}`,
      );
    }
    console.log(
      `${logPrefix} phase=user_payload_normalized clerk_user_id=${id} email=${resolvedEmail} full_name="${fullName}" phone=${phone || "empty"} timestamp=${requestTimestamp}`,
    );

    try {
      console.log(`${logPrefix} phase=db_upsert_start clerk_id=${id} email=${resolvedEmail} timestamp=${requestTimestamp}`);
      const result = await prisma.user.upsert({
        where: { clerkUserId: id },
        update: {
          fullName,
          email: resolvedEmail,
          phone,
        },
        create: {
          clerkUserId: id,
          fullName,
          email: resolvedEmail,
          phone,
        },
      });
      console.log(`${logPrefix} phase=user_upsert_success clerk_user_id=${id} db_user_id=${result.id} timestamp=${requestTimestamp}`);
    } catch (dbError) {
      const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error(`${logPrefix} phase=db_upsert_failed clerk_id=${id} error=${errorMsg} stack=${dbError instanceof Error ? dbError.stack : "no-stack"} timestamp=${requestTimestamp}`);
      return NextResponse.json({ error: "Database error during upsert", details: errorMsg }, { status: 500 });
    }
  }

  if (event.type === "user.deleted") {
    console.log(`${logPrefix} phase=handle_user_deleted timestamp=${requestTimestamp}`);
    const clerkUserId = event.data?.id as string | undefined;
    console.log(`${logPrefix} phase=extract_delete_data clerk_user_id=${clerkUserId} timestamp=${requestTimestamp}`);
    
    if (clerkUserId) {
      try {
        console.log(`${logPrefix} phase=db_delete_start clerk_user_id=${clerkUserId} timestamp=${requestTimestamp}`);
        const result = await prisma.user.updateMany({
          where: { clerkUserId },
          data: { clerkUserId: null },
        });
        console.log(
          `${logPrefix} phase=user_deleted_db_update clerk_user_id=${clerkUserId} rows_updated=${result.count} timestamp=${requestTimestamp}`,
        );
      } catch (dbError) {
        const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
        console.error(`${logPrefix} phase=db_delete_failed clerk_id=${clerkUserId} error=${errorMsg} stack=${dbError instanceof Error ? dbError.stack : "no-stack"} timestamp=${requestTimestamp}`);
        return NextResponse.json({ error: "Database error during delete", details: errorMsg }, { status: 500 });
      }
    } else {
      console.error(`${logPrefix} phase=user_deleted_validation status=failed reason=missing_id timestamp=${requestTimestamp}`);
    }
  }

  if (
    event.type !== "user.created" &&
    event.type !== "user.updated" &&
    event.type !== "user.deleted"
  ) {
    console.log(`${logPrefix} phase=event_ignored type=${event.type} timestamp=${requestTimestamp}`);
  }

  console.log(`${logPrefix} phase=complete status=success type=${event.type} timestamp=${requestTimestamp}`);
  return NextResponse.json({ success: true });
}

// 🟢 GET handler for testing - helps verify endpoint is reachable
export async function GET() {
  const timestamp = new Date().toISOString();
  console.log("🟢🟢🟢 WEBHOOK ENDPOINT GET REQUEST 🟢🟢🟢");
  console.log(`[clerk-webhook] GET request received at ${timestamp}`);
  
  return NextResponse.json({ 
    status: "ok",
    message: "Clerk webhook endpoint is reachable",
    timestamp,
    configurations: {
      webhookSecretSet: !!process.env.CLERK_WEBHOOK_SECRET,
      nodeEnv: process.env.NODE_ENV
    }
  });
}
