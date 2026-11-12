import { NextResponse } from 'next/server';

export async function GET() {
  const headers = ['Full Name', 'Roll Number', 'Email Address', 'Department', 'Batch'];
  const sampleRows = [
    ['Aarav Sharma', 'CS2026-001', 'aarav.sharma@example.edu', 'Computer Science & Engineering', '2026'],
    ['Priya Patel', 'CS2026-002', 'priya.patel@example.edu', 'Software Engineering', '2026'],
    ['Rohan Verma', 'CS2026-003', 'rohan.verma@example.edu', 'Computer Science', '2026'],
    ['Ananya Iyer', 'CS2026-004', 'ananya.iyer@example.edu', 'Information Technology', '2026'],
    ['Kabir Sen', 'CS2026-005', 'kabir.sen@example.edu', 'Mathematics & Computing', '2026'],
    ['Neha Kulkarni', 'CS2026-006', 'neha.kulkarni@example.edu', 'Data Science & Systems', '2026'],
    ['Vikram Malhotra', 'CS2026-007', 'vikram.m@example.edu', 'Electrical & Electronics', '2026'],
  ];

  const csvBody = [
    headers.join(','),
    ...sampleRows.map((row) => row.map((val) => `"${val}"`).join(',')),
  ].join('\n');

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="student_roster_sample_template.csv"',
    },
  });
}

