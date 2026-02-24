import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BookOpen, Github, Download } from "lucide-react";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2 font-bold">
          <span className="text-lg">🎣</span>
          <span>better-webhook</span>
        </span>
      ),
    },
    links: [
      {
        text: "Documentation",
        url: "/docs",
        icon: <BookOpen className="size-4" />,
      },
      {
        text: "Releases",
        url: "https://github.com/endalk200/better-webhook/releases",
        icon: <Download className="size-4" />,
        external: true,
      },
      {
        text: "GitHub",
        url: "https://github.com/endalk200/better-webhook",
        icon: <Github className="size-4" />,
        external: true,
      },
    ],
    githubUrl: "https://github.com/endalk200/better-webhook",
  };
}
