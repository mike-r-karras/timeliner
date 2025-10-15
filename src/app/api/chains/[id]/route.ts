import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Chain from '@/models/Chain';
import Event from '@/models/Event';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await dbConnect();

    const chain = await Chain.findOne({
      _id: id,
      createdBy: session.user.id,
    });

    if (!chain) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    return NextResponse.json(chain);
  } catch (error) {
    console.error('Error fetching chain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const {
      name,
      color,
      description,
    } = await request.json();

    await dbConnect();

    // First get the chain to verify ownership and get timelineId
    const existingChain = await Chain.findOne({
      _id: id,
      createdBy: session.user.id,
    });

    if (!existingChain) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) {
      updateData.name = name.trim();

      // Check for duplicate name if updating name (within same timeline)
      if (name.trim()) {
        const duplicateChain = await Chain.findOne({
          _id: { $ne: id },
          timelineId: existingChain.timelineId,
          name: name.trim(),
        });

        if (duplicateChain) {
          return NextResponse.json(
            { error: 'A chain with this name already exists in this timeline' },
            { status: 409 }
          );
        }
      }
    }
    if (color !== undefined) updateData.color = color;
    if (description !== undefined) updateData.description = description?.trim();

    const chain = await Chain.findOneAndUpdate(
      { _id: id, createdBy: session.user.id },
      updateData,
      { new: true }
    );

    if (!chain) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    return NextResponse.json(chain);
  } catch (error) {
    console.error('Error updating chain:', error);
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

    const chain = await Chain.findOneAndDelete({
      _id: id,
      createdBy: session.user.id,
    });

    if (!chain) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    // Remove this chain from all events that reference it
    await Event.updateMany(
      { chainIds: id },
      { $pull: { chainIds: id } }
    );

    return NextResponse.json({ message: 'Chain deleted successfully' });
  } catch (error) {
    console.error('Error deleting chain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
