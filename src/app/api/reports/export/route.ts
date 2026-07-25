import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// GET /api/reports/export?module=documents|training|capa|deviations|equipment
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const moduleType = req.nextUrl.searchParams.get('module') || 'documents';
    const format = req.nextUrl.searchParams.get('format') || 'csv';

    let csvContent = '';
    let filename = `veritas-${moduleType}-report.csv`;

    if (moduleType === 'documents') {
      const docs = await prisma.document.findMany({
        where: { tenantId: user.tenantId },
        include: { owner: true },
      });
      csvContent = 'ID,Title,Classification,Status,Owner,CurrentVersion,CreatedAt\n' +
        docs.map(d => `"${d.id}","${d.title.replace(/"/g, '""')}","${d.classification}","${d.status}","${d.owner.fullName}",v${d.currentVersionNumber}.0,"${d.createdAt.toISOString()}"`).join('\n');
    } else if (moduleType === 'training') {
      const trainings = await prisma.trainingAssignment.findMany({
        where: { user: { tenantId: user.tenantId } },
        include: { user: true, requirement: { include: { document: true } } },
      });
      csvContent = 'ID,User,Role,SOPTitle,Status,AssignedAt,CompletedAt\n' +
        trainings.map(t => `"${t.id}","${t.user.fullName}","${t.user.role}","${t.requirement.document.title.replace(/"/g, '""')}","${t.status}","${t.assignedAt.toISOString()}","${t.completedAt ? t.completedAt.toISOString() : 'N/A'}"`).join('\n');
    } else if (moduleType === 'capa') {
      const capas = await prisma.cAPA.findMany({
        where: { tenantId: user.tenantId },
        include: { assignedTo: true },
      });
      csvContent = 'ID,Title,Status,DueDate,AssignedTo,CompletedAt\n' +
        capas.map(c => `"${c.id}","${c.title.replace(/"/g, '""')}","${c.status}","${c.dueDate.toISOString()}","${c.assignedTo.fullName}","${c.completedAt ? c.completedAt.toISOString() : 'N/A'}"`).join('\n');
    } else if (moduleType === 'equipment') {
      const equipment = await prisma.equipment.findMany({
        where: { tenantId: user.tenantId },
      });
      csvContent = 'ID,Name,Location,Status,CalibrationIntervalDays,NextCalibrationDueDate\n' +
        equipment.map(e => `"${e.id}","${e.name.replace(/"/g, '""')}","${e.location}","${e.status}",${e.calibrationIntervalDays},"${e.nextCalibrationDueDate.toISOString()}"`).join('\n');
    } else {
      const deviations = await prisma.deviation.findMany({
        where: { tenantId: user.tenantId },
        include: { detectedBy: true },
      });
      csvContent = 'ID,Title,Classification,Status,DetectedBy,CreatedAt\n' +
        deviations.map(d => `"${d.id}","${d.title.replace(/"/g, '""')}","${d.classification}","${d.status}","${d.detectedBy.fullName}","${d.createdAt.toISOString()}"`).join('\n');
    }

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Report.Export',
      objectType: 'Report',
      payload: { moduleType, format },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Report export error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
