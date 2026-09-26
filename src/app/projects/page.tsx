import type { Metadata } from "next";
import { MyProjects } from "@/components/studio/my-projects";

export const metadata: Metadata = { title: "내 프로젝트 · Loop Station" };

export default function ProjectsPage() {
  return <MyProjects />;
}
