import { redirect } from "next/navigation";

// S0 — crew link resolution. Server-side, immediate redirect into the plateau
// carrying the crew context. No landing, no login, no "welcome" screen.
export default async function CrewResolve({ params }) {
  const { code } = await params;
  redirect(`/join?crew=${encodeURIComponent(code)}&s=crew`);
}
