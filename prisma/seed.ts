import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const roles = [
  { name: "admin", description: "Full system access" },
  { name: "srCRM", description: "Senior CRM manager" },
  { name: "jrCRM", description: "Junior CRM manager" },
  { name: "cad_operator", description: "CAD operations specialist" },
  { name: "3d_visualizer", description: "3D visualization specialist" },
];

const departments = [
  { name: "CRM", description: "Customer relationship management" },
  { name: "CAD", description: "CAD design team" },
  { name: "3D", description: "3D visualization team" },
  { name: "Accounts", description: "Finance and accounts team" },
];

const users = [
  {
    fullName: "Alice Johnson",
    email: "alice@aesthetic-crm.io",
    phone: "+1-555-0101",
    clerkUserId: "clerk_alice_001",
    roles: ["admin"],
    departments: ["CRM"],
  },
  {
    fullName: "Bob Smith",
    email: "bob@aesthetic-crm.io",
    phone: "+1-555-0102",
    clerkUserId: "clerk_bob_001",
    roles: ["srCRM"],
    departments: ["CRM"],
  },
  {
    fullName: "Carol Davis",
    email: "carol@aesthetic-crm.io",
    phone: "+1-555-0103",
    clerkUserId: "clerk_carol_001",
    roles: ["jrCRM"],
    departments: ["CRM"],
  },
  {
    fullName: "Dina Rahman",
    email: "dina@aesthetic-crm.io",
    phone: "+1-555-0104",
    clerkUserId: "clerk_dina_001",
    roles: ["cad_operator"],
    departments: ["CAD"],
  },
  {
    fullName: "Evan Lee",
    email: "evan@aesthetic-crm.io",
    phone: "+1-555-0105",
    clerkUserId: "clerk_evan_001",
    roles: ["3d_visualizer"],
    departments: ["3D"],
  },
];

const leads = [
  {
    name: "John Doe",
    email: "john.doe@email.com",
    phone: "+1-555-0201",
    status: "new",
    assigneeEmail: "bob@aesthetic-crm.io",
  },
  {
    name: "Jane Wilson",
    email: "jane.wilson@email.com",
    phone: "+1-555-0202",
    status: "contacted",
    assigneeEmail: "carol@aesthetic-crm.io",
  },
  {
    name: "Michael Brown",
    email: "michael.brown@email.com",
    phone: "+1-555-0203",
    status: "qualified",
    assigneeEmail: "alice@aesthetic-crm.io",
  },
];

async function main() {
  console.log("Seeding roles...");
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }

  console.log("Seeding departments...");
  for (const department of departments) {
    await prisma.department.upsert({
      where: { name: department.name },
      update: { description: department.description },
      create: department,
    });
  }

  console.log("Seeding users...");
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        phone: user.phone,
        clerkUserId: user.clerkUserId,
      },
      create: {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        clerkUserId: user.clerkUserId,
      },
    });
  }

  console.log("Seeding user-role mappings...");
  for (const user of users) {
    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: user.email } });
    for (const roleName of user.roles) {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: dbUser.id, roleId: role.id } },
        update: {},
        create: { userId: dbUser.id, roleId: role.id },
      });
    }
  }

  console.log("Seeding user-department mappings...");
  for (const user of users) {
    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: user.email } });
    for (const departmentName of user.departments) {
      const department = await prisma.department.findUniqueOrThrow({ where: { name: departmentName } });
      await prisma.userDepartment.upsert({
        where: {
          userId_departmentId: { userId: dbUser.id, departmentId: department.id },
        },
        update: {},
        create: { userId: dbUser.id, departmentId: department.id },
      });
    }
  }

  console.log("Resetting and seeding leads...");
  await prisma.lead.deleteMany({});
  for (const lead of leads) {
    const assignee = await prisma.user.findUnique({ where: { email: lead.assigneeEmail } });
    await prisma.lead.create({
      data: {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        assignedTo: assignee?.id ?? null,
      },
    });
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
