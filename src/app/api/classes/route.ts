// src/app/api/classes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withActiveProvider } from '@/lib/providers/withActiveProvider';

export const GET = withActiveProvider(async (request, context) => {
  const { provider, organizationId, apiClient } = context;
  
  try {
    // Check if provider supports classes/locations
    if (!provider.classes) {
      return NextResponse.json({ 
        error: 'Classes/Locations not supported by current provider' 
      }, { status: 400 });
    }

    // Get action from query params
    const action = request.nextUrl.searchParams.get('action');
    const classId = request.nextUrl.searchParams.get('classId');

    if (action === 'comparison') {
      // Get class comparison data - requires date range
      const start_date = request.nextUrl.searchParams.get('start_date') || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
      const end_date = request.nextUrl.searchParams.get('end_date') || new Date().toISOString().split('T')[0];
      
      const comparisonData = await (provider.classes as any).getClassComparison(
        organizationId,
        { start_date, end_date },
        apiClient
      );
      return NextResponse.json(comparisonData);
    } else {
      // Get classes and locations
      const [classes, locations] = await Promise.all([
        (provider.classes as any).listClasses(organizationId, {}, apiClient),
        (provider.classes as any).listLocations(organizationId, {}, apiClient)
      ]);

      return NextResponse.json({ classes, locations });
    }
  } catch (error) {
    console.error('Error in classes API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch classes data' }, 
      { status: 500 }
    );
  }
});