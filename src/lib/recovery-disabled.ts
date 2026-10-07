import { NextResponse } from 'next/server';

export function sensitiveExportDisabled() {
  return NextResponse.json(
    {
      error: {
        code: 'ExportDisabled',
        message: 'Sensitive data exports are temporarily unavailable',
      },
    },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '86400' },
    },
  );
}

export function userAdministrationMutationDisabled() {
  return NextResponse.json(
    {
      error: {
        code: 'UserAdministrationDisabled',
        message: 'User provisioning and role changes are temporarily unavailable',
      },
    },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '86400' },
    },
  );
}

export function trainingCompletionDisabled() {
  return NextResponse.json(
    {
      error: {
        code: 'TrainingCompletionDisabled',
        message: 'Training quiz and sign-off completion are temporarily unavailable',
      },
    },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '86400' },
    },
  );
}

export function changeControlDisabled() {
  return NextResponse.json(
    {
      error: {
        code: 'ChangeControlDisabled',
        message: 'Change-control workflows are temporarily unavailable',
      },
    },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '86400' },
    },
  );
}

export function qualityEventsDisabled() {
  return NextResponse.json(
    {
      error: {
        code: 'QualityEventsDisabled',
        message: 'Deviation and CAPA workflows are temporarily unavailable',
      },
    },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '86400' },
    },
  );
}
