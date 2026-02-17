"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  CalendarClock,
  Target,
  Settings,
  MapPin,
  RefreshCw,
  FolderPlus,
  BarChart3,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
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
  { href: "/settings", label: "Settings", icon: Settings },
];

function isNavItem(item: NavItem | NavDropdown): item is NavItem {
  return "href" in item;
}

interface MobileNavProps {
  onLogout: () => void;
}

export function MobileNav({ onLogout }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);
  const [expandedDropdown, setExpandedDropdown] = React.useState<string | null>(null);
  const pathname = usePathname();

  // Close menu when navigating
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function handleItemClick(href: string) {
    setOpen(false);
  }

  function toggleDropdown(label: string) {
    setExpandedDropdown(expandedDropdown === label ? null : label);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border shadow-lg p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-200">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="font-display font-semibold text-lg text-primary tracking-tight">
              powerhour
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <nav className="space-y-1">
            {navConfig.map((item, idx) =>
              isNavItem(item) ? (
                <MobileNavLink key={item.href} item={item} onClick={() => handleItemClick(item.href)} pathname={pathname} />
              ) : (
                <MobileNavDropdown
                  key={idx}
                  dropdown={item}
                  isExpanded={expandedDropdown === item.label}
                  onToggle={() => toggleDropdown(item.label)}
                  onItemClick={handleItemClick}
                  pathname={pathname}
                />
              )
            )}
          </nav>

          <div className="absolute bottom-6 left-6 right-6">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              Logout
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MobileNavLink({
  item,
  onClick,
  pathname,
}: {
  item: NavItem;
  onClick: () => void;
  pathname: string;
}) {
  const Icon = item.icon;
  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
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

function MobileNavDropdown({
  dropdown,
  isExpanded,
  onToggle,
  onItemClick,
  pathname,
}: {
  dropdown: NavDropdown;
  isExpanded: boolean;
  onToggle: () => void;
  onItemClick: (href: string) => void;
  pathname: string;
}) {
  const Icon = dropdown.icon;
  const hasActiveChild = dropdown.items.some((item) => pathname.startsWith(item.href));

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
          hasActiveChild
            ? "bg-accent text-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/80"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4" />
          {dropdown.label}
        </div>
        <ChevronDown
          className={cn("h-3 w-3 transition-transform duration-200", isExpanded && "rotate-180")}
        />
      </button>
      {isExpanded && (
        <div className="mt-1 ml-7 space-y-1">
          {dropdown.items.map((item) => {
            const ItemIcon = item.icon;
            const itemActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onItemClick(item.href)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                  itemActive
                    ? "bg-accent/50 text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                )}
              >
                <ItemIcon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
