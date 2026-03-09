import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { getToken } = await auth();
  const token = await getToken({ template: "postgres" });
  
  if (!token) {
    return NextResponse.json(
      { error: "No authenticated token. User may not be logged in." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    token,
    message: "Use this in Postman: Authorization: Bearer <token>"
  });
}