import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";


const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });

// PrismaPg’s constructor takes two params; the second is optional
// but typed as required in the definition.
const adapter = new PrismaPg(pool /* , { /* adapter options here */ } */ );

const prisma = new PrismaClient({ adapter });     // ← one argument supplied
// if you ever call it with no options you can do:
// const prisma = new PrismaClient({});

async function main() {
  // Clear existing data
  await prisma.userDepartment.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.note.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.leadStatusHistory.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.role.deleteMany();

  // Create Roles
  const adminRole = await prisma.role.create({
    data: {
      name: "Admin",
      description: "Administrator with full access",
    },
  });

  const salesRole = await prisma.role.create({
    data: {
      name: "Sales",
      description: "Sales representative",
    },
  });

  const managerRole = await prisma.role.create({
    data: {
      name: "Manager",
      description: "Sales manager",
    },
  });

  // Create Departments
  const salesDept = await prisma.department.create({
    data: {
      name: "Sales",
      description: "Sales department",
    },
  });

  const designDept = await prisma.department.create({
    data: {
      name: "Design",
      description: "Design department",
    },
  });

  // Create Users
  const user1 = await prisma.user.create({
    data: {
      fullName: "John Doe",
      email: "john@example.com",
      phone: "1234567890",
      clerkUserId: "clerk_123",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      fullName: "Jane Smith",
      email: "jane@example.com",
      phone: "0987654321",
      clerkUserId: "clerk_456",
    },
  });

  const user3 = await prisma.user.create({
    data: {
      fullName: "Mike Johnson",
      email: "mike@example.com",
      phone: "5555555555",
      clerkUserId: "clerk_789",
    },
  });

  // Assign Users to Roles
  await prisma.userRole.create({
    data: {
      userId: user1.id,
      roleId: adminRole.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: user2.id,
      roleId: salesRole.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: user3.id,
      roleId: managerRole.id,
    },
  });

  // Assign Users to Departments
  await prisma.userDepartment.create({
    data: {
      userId: user1.id,
      departmentId: salesDept.id,
    },
  });

  await prisma.userDepartment.create({
    data: {
      userId: user2.id,
      departmentId: salesDept.id,
    },
  });

  await prisma.userDepartment.create({
    data: {
      userId: user3.id,
      departmentId: designDept.id,
    },
  });

  // Create Leads
  const lead1 = await prisma.lead.create({
    data: {
      name: "Alice Brown",
      phone: "1111111111",
      email: "alice@example.com",
      source: "Website",
      status: "NEW",
      budget: 50000,
      location: "New York",
      remarks: "Interested in modern design",
      assignedTo: user2.id,
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      name: "Bob Wilson",
      phone: "2222222222",
      email: "bob@example.com",
      source: "Referral",
      status: "CONTACTED",
      budget: 75000,
      location: "Los Angeles",
      remarks: "Follow up next week",
      assignedTo: user2.id,
    },
  });

  const lead3 = await prisma.lead.create({
    data: {
      name: "Carol Davis",
      phone: "3333333333",
      email: "carol@example.com",
      source: "Social Media",
      status: "FOLLOWUP",
      budget: 100000,
      location: "Chicago",
      remarks: "Waiting for budget approval",
      assignedTo: user2.id,
    },
  });

  // Create Lead Status History
  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead1.id,
      oldStatus: "NEW",
      newStatus: "NEW",
      changedById: user2.id,
    },
  });

  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead2.id,
      oldStatus: "NEW",
      newStatus: "CONTACTED",
      changedById: user2.id,
    },
  });

  // Create Follow-ups
  const followUp1 = await prisma.followUp.create({
    data: {
      leadId: lead2.id,
      assignedToId: user2.id,
      followupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      status: "PENDING",
      notes: "Call to discuss budget and timeline",
    },
  });

  const followUp2 = await prisma.followUp.create({
    data: {
      leadId: lead3.id,
      assignedToId: user2.id,
      followupDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      status: "PENDING",
      notes: "Visit showroom",
    },
  });

  // Create Notes
  await prisma.note.create({
    data: {
      leadId: lead1.id,
      userId: user2.id,
      content: "Client prefers minimalist design with neutral colors",
    },
  });

  await prisma.note.create({
    data: {
      leadId: lead2.id,
      userId: user2.id,
      content: "Needs design for 2000 sq ft apartment",
    },
  });

  // Create Activity Logs
  await prisma.activityLog.create({
    data: {
      leadId: lead1.id,
      userId: user2.id,
      type: "NOTE",
      description: "Added note about design preferences",
    },
  });

  await prisma.activityLog.create({
    data: {
      leadId: lead2.id,
      userId: user2.id,
      type: "STATUS_CHANGE",
      description: "Changed status from NEW to CONTACTED",
    },
  });

  await prisma.activityLog.create({
    data: {
      leadId: lead2.id,
      userId: user2.id,
      type: "FOLLOWUP_SET",
      description: "Scheduled follow-up for next week",
    },
  });

  console.log("Seed data created successfully!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
