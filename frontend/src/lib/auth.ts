import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { SignJWT } from "jose";

async function makeGoToken(id: string, email: string, role: string, teamId: string): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? ""
  );
  return new SignJWT({ id, email, role, teamId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          }
        );

        if (!res.ok) return null;

        const user = await res.json();
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          teamId: user.teamId,
          accessToken: user.accessToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.teamId = user.teamId;
        token.accessToken = user.accessToken;
      }
      // Regenerate Go API token for existing sessions that pre-date the accessToken field
      if (!token.accessToken && token.id && token.email) {
        token.accessToken = await makeGoToken(
          token.id as string,
          token.email as string,
          (token.role as string) ?? "MEMBER",
          (token.teamId as string) ?? ""
        );
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.teamId = token.teamId as string;
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
