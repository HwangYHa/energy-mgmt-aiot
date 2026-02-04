/**
 * JWT Token Generation Endpoint
 *
 * Generates a JWT Bearer token for authenticated NextAuth sessions.
 * This bridges NextAuth session cookies with JWT Bearer token authentication.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SignJWT } from 'jose';
import { authOptions } from '@/lib/auth/session';
import env from '@/lib/env';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export async function GET() {
  try {
    // Check NextAuth session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - No active session' },
        { status: 401 }
      );
    }

    const user = session.user as {
      id: string;
      email: string;
      name: string;
      tenantId: string;
      role: string;
    };

    // Generate JWT token with same structure as verifyAuth expects
    const token = await new SignJWT({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    return NextResponse.json({
      accessToken: token,
      expiresIn: 86400, // 24 hours in seconds
      tokenType: 'Bearer',
    });
  } catch (error) {
    console.error('[Token API] Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
