import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Home, BookOpen, ClipboardList, BarChart3, FileCheck, Shield } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { getMyRole, getMyProfile } from "@/lib/prisma.functions";
import logoUrl from "@/assets/prisma-logo-white.png";
import crede3LogoUrl from "@/assets/crede3-logo.png";

const baseItems = [
  { title: "Página Inicial", url: "/painel", icon: Home },
  { title: "Tutoriais", url: "/tutoriais", icon: BookOpen },
  { title: "Avaliação Diagnóstica", url: "/avaliacao-diagnostica", icon: ClipboardList },
  { title: "Relatórios por Acerto e Padrões de Desempenho", url: "/relatorios", icon: BarChart3 },
  { title: "Gabarito e Material de Apoio", url: "/gabarito", icon: FileCheck },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const getRole = useServerFn(getMyRole);
  const getProfile = useServerFn(getMyProfile);
  const roleQ = useQuery({ queryKey: ["my-role"], queryFn: () => getRole() });
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => getProfile() });
  const items = roleQ.data?.isAdmin
    ? [...baseItems, { title: "Administração", url: "/admin", icon: Shield }]
    : baseItems;

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    professor: "Professor",
    aluno: "Aluno",
  };
  const profile = profileQ.data;
  const rolePriority = ["admin", "professor", "aluno"] as const;
  const primaryRole = profile?.roles
    ? rolePriority.find((r) => (profile.roles as string[]).includes(r)) ?? profile.roles[0]
    : null;
  const roleLabel = primaryRole ? (roleLabels[primaryRole] ?? primaryRole) : null;
  const initials = (profile?.fullName ?? profile?.email ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Sidebar
      collapsible="icon"
      style={
        {
          "--sidebar": "var(--brand-green-dark)",
          "--sidebar-foreground": "#ffffff",
          "--sidebar-accent": "rgba(255,255,255,0.14)",
          "--sidebar-accent-foreground": "#ffffff",
          "--sidebar-border": "rgba(255,255,255,0.14)",
          "--sidebar-ring": "rgba(255,255,255,0.4)",
          "--sidebar-primary": "#ffffff",
          "--sidebar-primary-foreground": "var(--brand-green-dark)",
        } as React.CSSProperties
      }
    >
      <SidebarHeader className="p-0">
        <div className="flex items-center justify-center bg-sidebar">
          <img
            src={logoUrl}
            alt="PRISMA — CREDE 3"
            className={
              collapsed
                ? "h-12 w-auto object-contain"
                : "block h-auto w-full object-contain"
            }
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/80">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = currentPath === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-0">
        {profile && (
          <div className="border-t border-sidebar-border px-3 py-3">
            {collapsed ? (
              <div
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-sidebar-foreground"
                title={`${profile.fullName ?? profile.email ?? ""}${roleLabel ? ` · ${roleLabel}` : ""}`}
              >
                {initials || "?"}
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-sidebar-foreground">
                  {initials || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">
                    {profile.fullName ?? "—"}
                  </p>
                  <p className="truncate text-xs text-sidebar-foreground/80">
                    {profile.email ?? "—"}
                  </p>
                  {roleLabel && (
                    <p className="truncate text-[11px] uppercase tracking-wide text-sidebar-foreground/70">
                      {roleLabel}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-center bg-white p-3">
          <img
            src={crede3LogoUrl}
            alt="CREDE 3"
            className={collapsed ? "h-8 w-auto object-contain" : "h-16 w-auto object-contain"}
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
