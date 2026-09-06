import { NextRequest, NextResponse } from 'next/server';
import { QuickBooksClient } from '@/lib/providers/quickbooks/client';
import { withActiveProvider } from '@/lib/providers/withActiveProvider';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  return withActiveProvider(async (req: NextRequest, { organizationId }: { organizationId: string }) => {
    try {
      const { invoiceId } = await context.params;

      if (!invoiceId) {
        return NextResponse.json(
          { success: false, error: 'Invoice ID is required' },
          { status: 400 }
        );
      }

      const client = new QuickBooksClient({ organizationId });

      try {
        // Fetch the invoice PDF from QuickBooks
        const pdfBuffer = await client.makeRequest<ArrayBuffer>(
          `invoice/${invoiceId}/pdf`,
          'GET',
          undefined,
          {
            responseType: 'arraybuffer'
          }
        );

        // Return the PDF as a blob
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="invoice-${invoiceId}.pdf"`
          }
        });

      } catch (error: any) {
        console.error('Error fetching invoice PDF:', error);

        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch invoice PDF from QuickBooks',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          { status: 500 }
        );
      }
    } catch (error: any) {
      console.error('Invoice PDF API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch invoice PDF',
          message: error.message
        },
        { status: 500 }
      );
    }
  })(request);
}
