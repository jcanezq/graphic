import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePDF } from "@/lib/pdf-export";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quotationId = params.id;
    
    // Fetch quotation
    const { data: quotation, error: qError } = await supabase
      .from("quotations")
      .select("*, items:quotation_items(*)")
      .eq("id", quotationId)
      .single();
      
    if (qError || !quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    // Fetch settings
    const { data: settings, error: sError } = await supabase
      .from("company_settings")
      .select("*")
      .single();

    if (sError || !settings) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    }

    // Generate PDF (returns ArrayBuffer)
    const pdfBuffer = await generatePDF(quotation, settings);

    // Return the PDF as a Blob/Response
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quotation.number}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
