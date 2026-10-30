import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { cloudAdapter } from "@/lib/api/cloud-adapter";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await cloudAdapter.user();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: Outlet,
});
