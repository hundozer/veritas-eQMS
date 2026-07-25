import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';


interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
}

interface QuizAnswer {
  questionId: string;
  answerIndex: string | number;
}

// GET /api/trainings - Get training assignments (either user-specific or complete tenant matrix)
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    // Determine scope based on role
    const isComplianceRole = user.role === 'ADMIN' || user.role === 'AUDITOR' || user.role === 'OWNER';

    if (isComplianceRole) {
      // 1. Get entire training matrix for the tenant
      const assignments = await prisma.trainingAssignment.findMany({
        where: {
          user: { tenantId: user.tenantId },
        },
        include: {
          user: true,
          requirement: {
            include: { document: true },
          },
          quizResult: true,
        },
        orderBy: { assignedAt: 'desc' },
      });

      // Log matrix view action
      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'Training.ViewMatrix',
        objectType: 'TrainingAssignment',
        payload: { scope: 'Tenant' },
        status: 'Success',
        requestUrl: req.nextUrl.pathname,
      });

      return NextResponse.json({ assignments, isMatrix: true });
    } else {
      // 2. Get assignments only for the current user
      const assignments = await prisma.trainingAssignment.findMany({
        where: {
          userId: user.id,
        },
        include: {
          requirement: {
            include: { document: true },
          },
          quizResult: true,
        },
        orderBy: { status: 'asc' }, // ASSIGNED first, then COMPLETED
      });

      // Log assignments view action
      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'Training.ViewAssignments',
        objectType: 'TrainingAssignment',
        payload: { scope: 'Self', count: assignments.length },
        status: 'Success',
        requestUrl: req.nextUrl.pathname,
      });

      return NextResponse.json({ assignments, isMatrix: false });
    }
  } catch (error: any) {
    console.error('List trainings error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// POST /api/trainings - Complete a training (e.g. submit quiz answers and sign-off)
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const body = await req.json();
    const { assignmentId, answers, esignPassword } = body;

    if (!assignmentId) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Assignment ID is required' } }, { status: 400 });
    }

    // Verify e-signature password
    if (!esignPassword || esignPassword.trim() === '') {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'E-signature confirmation password is required to sign off training' } }, { status: 400 });
    }

    const assignment = await prisma.trainingAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        requirement: {
          include: { document: true },
        },
      },
    });

    if (!assignment || assignment.userId !== user.id) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Training assignment not found' } }, { status: 404 });
    }

    if (assignment.status === 'COMPLETED') {
      return NextResponse.json({ error: { code: 'Conflict', message: 'Training is already completed' } }, { status: 409 });
    }

    // 1. Grade the quiz if a quiz is required
    let passed = true;
    let score = 100;
    
    if (assignment.requirement.requiresQuiz && assignment.requirement.quizQuestions) {
      const questions = JSON.parse(assignment.requirement.quizQuestions);
      let correctCount = 0;

      if (!answers || !Array.isArray(answers)) {
        return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Quiz answers are required' } }, { status: 400 });
      }

      questions.forEach((q: QuizQuestion) => {
        const userAnswer = answers.find((ans: QuizAnswer) => ans.questionId === q.id);
        if (userAnswer && parseInt(userAnswer.answerIndex) === q.correctAnswerIndex) {
          correctCount++;
        }
      });

      score = Math.round((correctCount / questions.length) * 100);
      passed = score >= 80; // 80% passing score
    }

    if (!passed) {
      // Create a quiz result entry but do not mark training as completed
      const quizResult = await prisma.quizResult.create({
        data: {
          userId: user.id,
          score,
          passed: false,
        },
      });

      // Log failure in GxP audit
      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'Training.Complete',
        objectType: 'TrainingAssignment',
        objectId: assignmentId,
        payload: {
          documentTitle: assignment.requirement.document.title,
          score,
          passed: false,
          esignPassword: '****',
        },
        status: 'Failed',
        requestUrl: req.nextUrl.pathname,
      });

      return NextResponse.json({
        success: false,
        message: 'Quiz failed. A passing score of 80% is required.',
        score,
        passed: false,
      });
    }

    // 2. Successful sign-off and completion transaction
    const result = await prisma.$transaction(async (tx: any) => {
      let quizResult = null;

      if (assignment.requirement.requiresQuiz) {
        quizResult = await tx.quizResult.create({
          data: {
            userId: user.id,
            score,
            passed: true,
          },
        });
      }

      const updatedAssignment = await tx.trainingAssignment.update({
        where: { id: assignmentId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          quizResultId: quizResult ? quizResult.id : null,
        },
      });

      return { updatedAssignment, quizResult };
    });

    // 3. Log GxP audit trail
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Training.Complete',
      objectType: 'TrainingAssignment',
      objectId: assignmentId,
      payload: {
        documentTitle: assignment.requirement.document.title,
        score,
        passed: true,
        esignSigner: user.fullName,
        esignMeaning: 'Verification of Training Completion',
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({
      success: true,
      assignment: result.updatedAssignment,
      score,
      passed: true,
    });
  } catch (error: any) {
    console.error('Submit training quiz error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
