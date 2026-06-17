import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, ClipboardList, BarChart3, FileCheck } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import logoUrl from "@/assets/prisma-logo-white.png";

const items = [
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

  return (
    <Sidebar
      collapsible="icon"
      style={
        {
          "--sidebar": "var(--brand-green)",
          "--sidebar-foreground": "#ffffff",
          "--sidebar-accent": "rgba(255,255,255,0.18)",
          "--sidebar-accent-foreground": "#ffffff",
          "--sidebar-border": "rgba(255,255,255,0.18)",
          "--sidebar-ring": "rgba(255,255,255,0.4)",
          "--sidebar-primary": "#ffffff",
          "--sidebar-primary-foreground": "var(--brand-green)",
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
    </Sidebar>
  );
}
