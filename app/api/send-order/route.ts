import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseServer } from "@/lib/supabase-server";

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

    console.log("ORDER FORM DATA:", {
      name,
      phone,
      hasFile: !!file,
      hasPreview: !!preview,
      hasScaledPdf: !!scaledPdf,
    });

    if (!name || !phone || !file) {
      return NextResponse.json(
        {
          error: `Дутуу мэдээлэл байна: name=${!!name}, phone=${!!phone}, file=${!!file}`,
        },
        { status: 400 },
      );
    }

    let previewUrl: string | null = null;

    if (preview) {
      const previewName = `orders/${Date.now()}-preview.png`;

      const { error: uploadError } = await supabaseServer.storage
        .from("orders")
        .upload(previewName, preview, {
          contentType: "image/png",
          upsert: false,
        });

      if (!uploadError) {
        const { data } = supabaseServer.storage
          .from("orders")
          .getPublicUrl(previewName);

        previewUrl = data.publicUrl;
      } else {
        console.error("PREVIEW UPLOAD ERROR:", uploadError);
      }
    }

    const { error: orderInsertError } = await supabaseServer
      .from("orders")
      .insert({
        name: String(name),
        phone: String(phone),
        file_url: previewUrl,
      });

    if (orderInsertError) {
      console.error("ORDER INSERT ERROR:", orderInsertError);
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

    const result = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "bbayru75@gmail.com",
      subject: "Шинэ захиалга",
      html: `
        <p><b>Нэр:</b> ${String(name)}</p>
        <p><b>Утас:</b> ${String(phone)}</p>
        ${
          previewUrl
            ? `<p><b>Preview:</b> <a href="${previewUrl}">Зураг харах</a></p>`
            : ""
        }
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

    return NextResponse.json({ success: true, previewUrl });
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
