import {
  Banknote,
  Calendar,
  Car,
  ChartBar,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  Fingerprint,
  Forklift,
  Gauge,
  GraduationCap,
  Heart,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Lock,
  type LucideIcon,
  Mail,
  Megaphone,
  MessageSquare,
  Milestone,
  ReceiptText,
  ScanFace,
  Search,
  Server,
  Shield,
  ShoppingBag,
  Sparkles,
  SquareArrowUpRight,
  Users,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboards",
    items: [
      {
        id: "default",
        title: "Default",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        id: "crm",
        title: "CRM",
        url: "/crm",
        icon: ChartBar,
      },
      {
        id: "finance",
        title: "Finance",
        url: "/finance",
        icon: Banknote,
      },
      {
        id: "analytics",
        title: "Analytics",
        url: "/analytics",
        icon: Gauge,
      },
      {
        id: "productivity",
        title: "Productivity",
        url: "/productivity",
        icon: ListTodo,
      },
      {
        id: "ecommerce",
        title: "E-commerce",
        url: "/ecommerce",
        icon: ShoppingBag,
      },
      {
        id: "academy",
        title: "Academy",
        url: "/academy",
        icon: GraduationCap,
      },
      {
        id: "logistics",
        title: "Logistics",
        url: "/logistics",
        icon: Forklift,
      },
      {
        id: "infrastructure",
        title: "Infrastructure",
        url: "/infrastructure",
        icon: Server,
        badge: "new",
      },
    ],
  },
  {
    id: 2,
    label: "Operations",
    items: [
      {
        id: "vehicles",
        title: "Vehicles",
        url: "/vehicles",
        icon: Car,
      },
      {
        id: "showroom",
        title: "Showroom",
        url: "/staff-showroom",
        icon: Eye,
      },
      {
        id: "favourites",
        title: "Favourites",
        url: "/favourites",
        icon: Heart,
      },
      {
        id: "content",
        title: "Content",
        url: "/content",
        icon: Megaphone,
      },
      {
        id: "inspections",
        title: "Inspections",
        url: "/inspections",
        icon: ClipboardList,
      },
      {
        id: "inquiries",
        title: "Inquiries",
        url: "/inquiries",
        icon: MessageSquare,
      },
      {
        id: "recommendations",
        title: "Recommendations",
        url: "/staff-recommendations",
        icon: Sparkles,
      },
      {
        id: "transactions",
        title: "Transactions",
        url: "/transactions",
        icon: ReceiptText,
      },
      {
        id: "roadmap",
        title: "Roadmap",
        url: "/roadmap",
        icon: Milestone,
      },
      {
        id: "suppliers",
        title: "Suppliers",
        url: "/suppliers",
        icon: ScanFace,
      },
    ],
  },
  {
    id: 3,
    label: "Staff Management",
    items: [
      {
        id: "staff-records",
        title: "Staff Records",
        url: "/staff-records",
        icon: Users,
      },
      {
        id: "attendance",
        title: "Attendance",
        url: "/attendance",
        icon: Clock,
      },
      {
        id: "employee-requests",
        title: "Requests",
        url: "/employee-requests",
        icon: FileText,
      },
      {
        id: "payroll",
        title: "Payroll",
        url: "/payroll",
        icon: Banknote,
      },
      {
        id: "payslips",
        title: "Payslips",
        url: "/payslips",
        icon: ReceiptText,
      },
      {
        id: "field-cases",
        title: "Field Cases",
        url: "/field-cases",
        icon: Forklift,
      },
      {
        id: "security-duty-checks",
        title: "Security Checks",
        url: "/security-duty-checks",
        icon: Shield,
      },
      {
        id: "reports",
        title: "Reports",
        url: "/reports",
        icon: ChartBar,
      },
      {
        id: "announcements",
        title: "Announcements",
        url: "/announcements",
        icon: Megaphone,
      },
      {
        id: "supplier-messages",
        title: "Suppliers",
        url: "/supplier-messages",
        icon: ScanFace,
      },
    ],
  },
  {
    id: 4,
    label: "Pages",
    items: [
      {
        id: "email",
        title: "Email",
        url: "/mail",
        icon: Mail,
      },
      {
        id: "chat",
        title: "Chat",
        url: "/chat",
        icon: MessageSquare,
      },
      {
        id: "calendar",
        title: "Calendar",
        url: "/calendar",
        icon: Calendar,
      },
      {
        id: "kanban",
        title: "Kanban",
        url: "/kanban",
        icon: Kanban,
      },
      {
        id: "invoice",
        title: "Invoice",
        url: "/invoice",
        icon: ReceiptText,
      },
      {
        id: "users",
        title: "Users",
        url: "/users",
        icon: Users,
      },
      {
        id: "roles",
        title: "Roles",
        url: "/roles",
        icon: Lock,
      },
      {
        id: "authentication",
        title: "Authentication",
        icon: Fingerprint,
        subItems: [
          { id: "auth-login-v1", title: "Login v1", url: "/auth/v1/login", newTab: true },
          { id: "auth-login-v2", title: "Login v2", url: "/auth/v2/login", newTab: true },
          { id: "auth-register-v1", title: "Register v1", url: "/auth/v1/register", newTab: true },
          { id: "auth-register-v2", title: "Register v2", url: "/auth/v2/register", newTab: true },
        ],
      },
    ],
  },
  {
    id: 5,
    label: "Legacy",
    items: [
      {
        id: "legacy-dashboards",
        title: "Dashboards",
        subItems: [
          { id: "legacy-default", title: "Default V1", url: "/default-v1" },
          { id: "legacy-crm", title: "CRM V1", url: "/crm-v1" },
          { id: "legacy-finance", title: "Finance V1", url: "/finance-v1" },
          { id: "legacy-analytics", title: "Analytics V1", url: "/analytics-v1" },
        ],
      },
    ],
  },
  {
    id: 6,
    label: "Misc",
    items: [
      {
        id: "others",
        title: "Others",
        url: "/coming-soon",
        icon: SquareArrowUpRight,
        badge: "soon",
        disabled: true,
      },
    ],
  },
  {
    id: 7,
    label: "Customer Portal",
    items: [
      {
        id: "cust-showroom",
        title: "Showroom",
        url: "/showroom",
        icon: Car,
      },
      {
        id: "cust-recommendations",
        title: "Find Your Car",
        url: "/recommendations",
        icon: Sparkles,
      },
      {
        id: "cust-inquiries",
        title: "My Inquiries",
        url: "/my-inquiries",
        icon: MessageSquare,
      },
      {
        id: "cust-transactions",
        title: "Transactions",
        url: "/my-transactions",
        icon: ReceiptText,
      },
      {
        id: "cust-request-car",
        title: "Request a Car",
        url: "/request-a-car",
        icon: Search,
      },
      {
        id: "cust-sell-vehicle",
        title: "Sell Vehicle",
        url: "/sell-vehicle",
        icon: Banknote,
      },
      {
        id: "cust-favourites",
        title: "Favourites",
        url: "/favourites",
        icon: Heart,
      },
    ],
  },
  {
    id: 8,
    label: "Supplier Portal",
    items: [
      {
        id: "supplier-overview",
        title: "My Supplier Profile",
        url: "/overview",
        icon: ScanFace,
      },
    ],
  },
];
