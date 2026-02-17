"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "./mobile-nav";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  CalendarClock,
  Target,
  Settings,
  LogOut,
  MapPin,
  RefreshCw,
  FolderPlus,
  ChevronDown,
  BarChart3,
  User,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string | React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavDropdown {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

type NavConfig = (NavItem | NavDropdown)[];

const navConfig: NavConfig = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Transactions",
    icon: ArrowLeftRight,
    items: [
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/transactions/groups", label: "Expense Groups", icon: FolderPlus },
    ],
  },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  {
    label: "Planning",
    icon: BarChart3,
    items: [
      { href: "/projections", label: "Projections", icon: CalendarClock },
      { href: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
      { href: "/budgets", label: "Budgets", icon: Target },
      { href: "/budget-planner", label: "Budget Planner", icon: MapPin },
    ],
  },
];

function isNavItem(item: NavItem | NavDropdown): item is NavItem {
  return "href" in item;
}

function NavItemLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors",
        isActive
          ? "bg-accent text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/80"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

function NavDropdownMenu({ dropdown, pathname }: { dropdown: NavDropdown; pathname: string }) {
  const Icon = dropdown.icon;
  const isActive = dropdown.items.some((item) => pathname.startsWith(item.href));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors",
            isActive
              ? "bg-accent text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/80"
          )}
        >
          <Icon className="h-4 w-4" />
          {dropdown.label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {dropdown.items.map((item, idx) => {
          const ItemIcon = item.icon;
          const itemActive = pathname.startsWith(item.href);
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  itemActive && "bg-accent/50 font-medium"
                )}
              >
                <ItemIcon className="h-4 w-4" />
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-border/60 bg-card">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-10">
            <Link href="/" className="font-display font-semibold text-lg text-primary tracking-tight">
              powerhour
            </Link>
            <div className="hidden md:flex items-center gap-0.5">
              {navConfig.map((item, idx) =>
                isNavItem(item) ? (
                  <NavItemLink key={item.href} item={item} pathname={pathname} />
                ) : (
                  <NavDropdownMenu key={idx} dropdown={item} pathname={pathname} />
                )
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile menu */}
            <MobileNav onLogout={handleLogout} />

            {/* Desktop user menu */}
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
                    <User className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer">
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
