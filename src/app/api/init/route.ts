import { NextResponse } from 'next/server';
import { createDefaultAdmin } from '@/lib/auth';

export async function POST() {
  try {
    await createDefaultAdmin();
    return NextResponse.json({ message: 'Default admin user initialized' });
  } catch (error) {
    console.error('Error initializing admin user:', error);
    return NextResponse.json({ error: 'Failed to initialize admin user' }, { status: 500 });
  }
}