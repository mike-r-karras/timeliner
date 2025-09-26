import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function POST() {
  try {
    console.log('Starting admin user initialization...');
    await dbConnect();
    console.log('Database connected');

    // Check if admin exists
    const existingAdmin = await User.findOne({ username: 'root' });
    console.log('Existing admin check:', existingAdmin ? 'Found' : 'Not found');

    if (!existingAdmin) {
      console.log('Creating admin user...');
      const hashedPassword = await bcrypt.hash('toor', 12);
      console.log('Password hashed');

      const newAdmin = await User.create({
        username: 'root',
        password: hashedPassword,
        role: 'admin',
      });
      console.log('Admin user created:', newAdmin.username);

      return NextResponse.json({
        message: 'Admin user created successfully',
        username: 'root',
        id: newAdmin._id
      });
    } else {
      console.log('Admin user already exists');
      return NextResponse.json({
        message: 'Admin user already exists',
        username: existingAdmin.username,
        id: existingAdmin._id
      });
    }
  } catch (error) {
    console.error('Error in admin initialization:', error);
    return NextResponse.json({
      error: 'Failed to initialize admin user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    await dbConnect();

    const adminUser = await User.findOne({ username: 'root' });

    if (adminUser) {
      return NextResponse.json({
        message: 'Admin user exists',
        username: adminUser.username,
        role: adminUser.role,
        id: adminUser._id
      });
    } else {
      return NextResponse.json({
        message: 'Admin user does not exist'
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Error checking admin user:', error);
    return NextResponse.json({
      error: 'Failed to check admin user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}