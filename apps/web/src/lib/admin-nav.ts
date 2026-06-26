import type { SessionUser } from "./auth/session";
import type { BoLang } from "./i18n/bo";

export type NavItem = { href: string; en: string; zh: string };
export type NavGroup = { en: string; zh: string; items: NavItem[] };

export function label(x: { en: string; zh: string }, lang: BoLang): string {
  return lang === "zh" ? x.zh : x.en;
}

/** Grouped back-office navigation, tailored to the user's role. */
export function buildNav(user: SessionUser): NavGroup[] {
  if (user.role === "PLANNER") {
    return [
      {
        en: "Delivery", zh: "执行",
        items: [
          { href: "/planning", en: "Planning", zh: "策划" },
          { href: "/planning/locations", en: "Locations", zh: "地点" },
          { href: "/admin/expenses", en: "Expenses", zh: "报销" },
          { href: "/admin/petty-cash", en: "Petty Cash", zh: "零用现金" },
        ],
      },
    ];
  }

  const groups: NavGroup[] = [
    {
      en: "Overview", zh: "概览",
      items: [
        { href: "/admin", en: "Dashboard", zh: "仪表板" },
        { href: "/admin/calendar", en: "Calendar", zh: "日历" },
      ],
    },
    {
      en: "Sales", zh: "销售",
      items: [
        { href: "/admin/leads", en: "Leads", zh: "询问" },
        { href: "/admin/quotations", en: "Quotations", zh: "报价" },
        { href: "/admin/bookings", en: "Bookings", zh: "预订" },
        { href: "/admin/invoices", en: "Invoices", zh: "发票" },
      ],
    },
    {
      en: "Delivery", zh: "执行",
      items: [
        { href: "/planning", en: "Planning", zh: "策划" },
        { href: "/admin/packages", en: "Packages", zh: "配套" },
        { href: "/admin/expenses", en: "Expenses", zh: "报销" },
          { href: "/admin/petty-cash", en: "Petty Cash", zh: "零用现金" },
      ],
    },
    {
      en: "Marketing", zh: "营销",
      items: [
        { href: "/admin/portfolio", en: "Portfolio", zh: "作品集" },
        { href: "/admin/whatsapp", en: "WhatsApp", zh: "WhatsApp" },
      ],
    },
  ];

  const admin: NavItem[] = [{ href: "/admin/users", en: "Staff", zh: "员工" }];
  if (user.role === "SUPER_ADMIN" || user.role === "COMPANY_ADMIN") {
    admin.push({ href: "/admin/finance", en: "Finance (P&L)", zh: "财务（损益）" });
  }
  if (user.role === "SUPER_ADMIN") {
    admin.push({ href: "/admin/companies", en: "Companies", zh: "公司" });
    admin.push({ href: "/admin/reports", en: "Group reports", zh: "报表" });
  } else if (user.role === "COMPANY_ADMIN" && user.companyId) {
    admin.push({ href: `/admin/companies/${user.companyId}`, en: "Settings", zh: "设置" });
  }
  groups.push({ en: "Admin", zh: "管理", items: admin });

  return groups;
}
