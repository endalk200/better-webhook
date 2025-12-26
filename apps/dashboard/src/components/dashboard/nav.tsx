import type { ReactNode } from "react";
import {
  FolderOpenIcon,
  PaperPlaneTiltIcon,
  FileTextIcon,
  GearIcon,
} from "@phosphor-icons/react";

export type NavKey = "captures" | "templates" | "run" | "settings";

export type NavItem = {
  key: NavKey;
  label: string;
  icon: ReactNode;
};

export const navItems: NavItem[] = [
  { key: "captures", label: "Captures", icon: <FolderOpenIcon /> },
  { key: "templates", label: "Templates", icon: <FileTextIcon /> },
  { key: "run", label: "Run", icon: <PaperPlaneTiltIcon /> },
  { key: "settings", label: "Settings", icon: <GearIcon /> },
];


