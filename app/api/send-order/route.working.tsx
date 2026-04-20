import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY тохируулаагүй байна" },
        { status: 500 },
      );
    }

    const resend = new Resend(apiKey);
    const formData = await req.formData();

    const name = formData.get("name");
    const phone = formData.get("phone");
    const file = formData.get("file") as File | null;
    const scaledPdf = formData.get("scaledPdf") as File | null;
    const preview = formData.get("preview") as File | null;

    console.log("PREVIEW FILE:", preview);

    if (!name || !phone || !file) {
      return NextResponse.json(
        { error: "Дутуу мэдээлэл байна" },
        { status: 400 },
      );
    }

    const attachments: Array<{
      filename: string;
      content: Buffer;
    }> = [
      {
        filename: "design-print.pdf",
        content: Buffer.from(await file.arrayBuffer()),
      },
    ];

    if (scaledPdf) {
      attachments.push({
        filename: "design-scaled.pdf",
        content: Buffer.from(await scaledPdf.arrayBuffer()),
      });
    }

    if (preview) {
      attachments.push({
        filename: "design-preview.png",
        content: Buffer.from(await preview.arrayBuffer()),
      });
    }

    console.log(
      "ATTACHMENTS:",
      attachments.map((a) => ({
        filename: a.filename,
        size: a.content.length,
      })),
    );

    const result = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "bbayru75@gmail.com",
      subject: "Шинэ захиалга",
      html: `
        <p><b>Нэр:</b> ${String(name)}</p>
        <p><b>Утас:</b> ${String(phone)}</p>
      `,
      attachments,
    });

    console.log("RESEND RESULT:", result);

    if ((result as any)?.error) {
      return NextResponse.json(
        { error: (result as any).error.message || "Email илгээж чадсангүй" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("SEND ORDER ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "Илгээх үед алдаа гарлаа",
      },
      { status: 500 },
    );
  }
}
