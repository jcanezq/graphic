import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LogoutButton from "@/components/LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userName =
    user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Usuario";
  const userEmail = user.email || "";

  return (
    <div className="app-layout">
      <Sidebar userName={userName} userEmail={userEmail} />
      <main className="main-content">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "12px 32px",
            borderBottom: "1px solid var(--surface-divider)",
          }}
        >
          <LogoutButton />
        </div>
        {children}
      </main>
    </div>
  );
}
