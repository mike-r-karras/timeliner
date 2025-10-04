import bcrypt from 'bcryptjs';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('Auth attempt for username:', credentials?.username);

        if (!credentials?.username || !credentials?.password) {
          console.log('Missing credentials');
          return null;
        }

        await dbConnect();

        try {
          const user = await User.findOne({ username: credentials.username });
          console.log('User found:', user ? 'Yes' : 'No');

          if (!user) {
            console.log('User not found in database');
            return null;
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          console.log('Password valid:', isPasswordValid);

          if (!isPasswordValid) {
            console.log('Invalid password');
            return null;
          }

          console.log('Authentication successful for:', user.username);
          return {
            id: user._id.toString(),
            username: user.username,
            role: user.role,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};

export async function createDefaultAdmin() {
  await dbConnect();

  const existingAdmin = await User.findOne({ username: 'root' });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('toor', 12);
    await User.create({
      username: 'root',
      password: hashedPassword,
      role: 'admin',
    });
    console.log('Default admin user created: root/toor');
  }
}