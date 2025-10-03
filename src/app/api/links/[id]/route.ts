import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Link from '@/models/Link';
import LinkLink from '@/models/LinkLink';
import { authOptions } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, url } = body;

    if (!title?.trim() || !url?.trim()) {
      return NextResponse.json({ error: 'Title and URL are required' }, { status: 400 });
    }

    await dbConnect();

    // Verify user has access to this link
    const linkLink = await LinkLink.findOne({
      linkId: id,
      createdBy: session.user.id,
    });

    if (!linkLink) {
      return NextResponse.json({ error: 'Link not found or unauthorized' }, { status: 404 });
    }

    // Update link
    const updatedLink = await Link.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        url: url.trim(),
      },
      { new: true }
    );

    if (!updatedLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Link updated successfully',
      link: {
        _id: updatedLink._id,
        title: updatedLink.title,
        url: updatedLink.url,
      },
    });
  } catch (error) {
    console.error('Error updating link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await dbConnect();

    // Find the link link to delete (id is the link ID)
    const linkLink = await LinkLink.findOne({
      linkId: id,
      createdBy: session.user.id,
    });

    if (!linkLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    // Delete the link link
    await LinkLink.findByIdAndDelete(linkLink._id);

    // Check if there are any other links to this link
    const remainingLinks = await LinkLink.countDocuments({ linkId: id });

    // If no other links exist, delete the link itself
    if (remainingLinks === 0) {
      await Link.findByIdAndDelete(id);
    }

    return NextResponse.json({ message: 'Link deleted successfully' });
  } catch (error) {
    console.error('Error deleting link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
