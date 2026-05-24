import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const messageId = String(id || "").trim();
  if (!messageId) {
    return NextResponse.json(
      { ok: false, error: "messageId が不正です。" },
      { status: 400 }
    );
  }

  try {
    const exists = await prisma.generatedMessage.findFirst({
      where: { id: messageId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json(
        { ok: false, error: "メッセージが見つかりません。" },
        { status: 404 }
      );
    }

    await prisma.generatedMessage.update({
      where: { id: messageId },
      data: { copiedAt: new Date() },
      select: { id: true },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "更新に失敗しました。",
      },
      { status: 500 }
    );
  }
}

