export type TeamRole = "Owner" | "Admin" | "Member";

export type ModuleKey = "requirements" | "work-items" | "test-planning" | "test-cases" | "test-cycles";

export type Team = {
  id: string;
  name: string;
  role: TeamRole;
  memberCount: number;
  projectCount: number;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: TeamRole;
  modules: ModuleKey[];
  joinedAt: string;
};
