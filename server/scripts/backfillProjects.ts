// One-off script: create a "General" project for every user who already has
// requirements, then backfill those requirements' projectId. Run once via:
//   npx tsx scripts/backfillProjects.ts
// Safe to delete after running.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userIds = await prisma.requirement.findMany({
    where: { projectId: null },
    distinct: ["createdById"],
    select: { createdById: true },
  });

  for (const { createdById } of userIds) {
    const project = await prisma.project.create({
      data: {
        name: "General",
        description: "Default project created automatically for existing requirements.",
        createdById,
      },
    });
    const { count } = await prisma.requirement.updateMany({
      where: { createdById, projectId: null },
      data: { projectId: project.id },
    });
    console.log(`User ${createdById}: created project ${project.id}, backfilled ${count} requirement(s).`);
  }

  const remaining = await prisma.requirement.count({ where: { projectId: null } });
  console.log(`Done. Requirements still without a project: ${remaining}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
