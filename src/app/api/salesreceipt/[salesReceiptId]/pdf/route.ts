import { NextRequest, NextResponse } from 'next/server';
import { QuickBooksClient } from '@/lib/providers/quickbooks/client';
import { withActiveProvider } from '@/lib/providers/withActiveProvider';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ salesReceiptId: string }> }
) {
  return withActiveProvider(async (req: NextRequest, { organizationId }: { organizationId: string }) => {
    try {
      const { salesReceiptId } = await context.params;

      if (!salesReceiptId) {
        return NextResponse.json(
          { success: false, error: 'Sales Receipt ID is required' },
          { status: 400 }
        );
      }

      const client = new QuickBooksClient({ organizationId });

      try {
        // Fetch the sales receipt PDF from QuickBooks
        const pdfBuffer = await client.makeRequest<ArrayBuffer>(
          `salesreceipt/${salesReceiptId}/pdf`,
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
            'Content-Disposition': `inline; filename="salesreceipt-${salesReceiptId}.pdf"`
          }
        });

      } catch (error: any) {
        console.error('Error fetching sales receipt PDF:', error);

        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch sales receipt PDF from QuickBooks',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          { status: 500 }
        );
      }
    } catch (error: any) {
      console.error('Sales Receipt PDF API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch sales receipt PDF',
          message: error.message
        },
        { status: 500 }
      );
    }
  })(request);
}
