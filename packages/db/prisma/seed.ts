import { PrismaClient, UserRole, EventType, Language } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "owner@platform.local";
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? "ChangeMe123!";

// Global checklist templates — seed PlanningTasks when a booking is created.
const CHECKLISTS: { eventType: EventType; items: { title: string; category: string }[] }[] = [
  {
    eventType: EventType.WEDDING,
    items: [
      { title: "Confirm theme & colour palette", category: "Design" },
      { title: "Finalise stage & backdrop design", category: "Design" },
      { title: "Source/confirm floral arrangements", category: "Floral" },
      { title: "Lighting plan & rigging", category: "Lighting" },
      { title: "Confirm venue layout & access times", category: "Venue" },
      { title: "Assign setup & teardown crew", category: "Operations" },
      { title: "Confirm balance payment", category: "Finance" },
      { title: "Event-day run sheet finalised", category: "Operations" },
    ],
  },
  {
    eventType: EventType.CORPORATE,
    items: [
      { title: "Confirm branding & signage", category: "Design" },
      { title: "Stage / backdrop build", category: "Design" },
      { title: "AV & lighting setup", category: "AV" },
      { title: "Seating & floor plan", category: "Venue" },
      { title: "Crew assignment", category: "Operations" },
      { title: "Confirm balance payment", category: "Finance" },
    ],
  },
  {
    eventType: EventType.BIRTHDAY,
    items: [
      { title: "Confirm theme & decor", category: "Design" },
      { title: "Balloon & backdrop setup", category: "Decor" },
      { title: "Confirm cake/dessert table styling", category: "Decor" },
      { title: "Crew assignment", category: "Operations" },
      { title: "Confirm balance payment", category: "Finance" },
    ],
  },
];

async function main() {
  console.log("Seeding…");

  // 1) Global checklist templates (idempotent on companyId+eventType)
  for (const c of CHECKLISTS) {
    const existing = await prisma.checklistTemplate.findFirst({
      where: { companyId: null, eventType: c.eventType },
    });
    if (existing) {
      await prisma.checklistTemplate.update({
        where: { id: existing.id },
        data: { items: c.items },
      });
    } else {
      await prisma.checklistTemplate.create({
        data: { companyId: null, eventType: c.eventType, items: c.items },
      });
    }
  }
  console.log(`  ✓ ${CHECKLISTS.length} global checklist templates`);

  // 2) Super-admin (group level, no company)
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {},
    create: {
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      name: "Group Owner",
      role: UserRole.SUPER_ADMIN,
      companyId: null,
    },
  });
  console.log(`  ✓ super-admin ${SUPER_ADMIN_EMAIL}`);

  // 3) Demo company
  let company = await prisma.company.findFirst({ where: { name: "Bloom & Co Events" } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "Bloom & Co Events",
        legalName: "Bloom & Co Events Sdn Bhd",
        ssmRegNo: "202601000000",
        sstRegistered: true,
        sstRegNo: "W10-1808-00000000",
        sstRate: "8.00",
        brandPrimary: "#c9a35b",
        brandSecondary: "#2a2440",
        city: "Kuala Lumpur",
        state: "Wilayah Persekutuan",
        postcode: "50000",
        phone: "+60 3-1234 5678",
        email: "hello@bloomco.example",
        bankName: "Maybank",
        bankAccountName: "Bloom & Co Events Sdn Bhd",
        bankAccountNo: "5123 4567 8901",
        quotePrefix: "BLOOM-Q",
        invoicePrefix: "BLOOM-INV",
        defaultProfitPercent: "35.00",
        defaultDepositPercent: "50.00",
        defaultLanguage: Language.EN,
        customDomains: ["bloomco.example"],
      },
    });
  }
  console.log(`  ✓ company ${company.name} (${company.id})`);

  // 4) Company admin
  await prisma.user.upsert({
    where: { email: "admin@bloomco.example" },
    update: {},
    create: {
      email: "admin@bloomco.example",
      passwordHash,
      name: "Bloom Admin",
      role: UserRole.COMPANY_ADMIN,
      companyId: company.id,
    },
  });
  console.log("  ✓ company admin admin@bloomco.example");

  // 5) Sample location, supplier, inventory
  const locationCount = await prisma.location.count({ where: { companyId: company.id } });
  if (locationCount === 0) {
    await prisma.location.create({
      data: {
        companyId: company.id,
        name: "Grand Ballroom, KLCC",
        city: "Kuala Lumpur",
        state: "Wilayah Persekutuan",
        capacity: 500,
      },
    });
    await prisma.supplier.create({
      data: { companyId: company.id, name: "Petal Florists", type: "Florist", phone: "+60 12-345 6789" },
    });
    await prisma.inventoryItem.createMany({
      data: [
        { companyId: company.id, name: "Floral Arch", category: "Backdrop", qtyTotal: 5, qtyAvailable: 5, unit: "pcs" },
        { companyId: company.id, name: "Fairy Light String (10m)", category: "Lighting", qtyTotal: 50, qtyAvailable: 50, unit: "pcs" },
        { companyId: company.id, name: "Chiavari Chair", category: "Furniture", qtyTotal: 300, qtyAvailable: 300, unit: "pcs" },
      ],
    });
    console.log("  ✓ sample location / supplier / inventory");
  }

  // 6) Sample customer + lead
  const refNo = "BLOOM-EVT-2026-0001";
  const existingLead = await prisma.lead.findUnique({ where: { referenceNo: refNo } });
  if (!existingLead) {
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        name: "Aisyah Rahman",
        email: "aisyah@example.com",
        phone: "+60 19-876 5432",
        language: Language.MS,
        source: "website",
      },
    });
    await prisma.lead.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        referenceNo: refNo,
        eventType: EventType.WEDDING,
        eventDate: new Date("2026-11-14T10:00:00Z"),
        venueText: "Grand Ballroom, KLCC",
        guestCount: 300,
        budgetMin: "30000",
        budgetMax: "50000",
        theme: "Garden romance — blush & gold",
        colors: ["blush", "gold", "ivory"],
        services: ["stage", "floral", "lighting", "backdrop"],
        message: "Looking for an elegant garden-themed wedding setup.",
        preferredLanguage: Language.MS,
      },
    });
    console.log(`  ✓ sample lead ${refNo}`);
  }

  console.log("Seed complete.");
  console.log(`\nLogin (after Phase 2 auth):`);
  console.log(`  super-admin: ${SUPER_ADMIN_EMAIL} / ${DEFAULT_PASSWORD}`);
  console.log(`  company admin: admin@bloomco.example / ${DEFAULT_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
