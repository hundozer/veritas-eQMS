import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: "Regulatory Intelligence Engine Rebuild in progress" });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ message: "Regulatory Intelligence Engine Rebuild in progress" });
}
