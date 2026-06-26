"use client";

import { ExternalLink } from "lucide-react";
import { SettingsPageHeader } from "@/components/features/settings/settings-header";
import { MCPEndpointCard } from "./mcp-endpoint-card";
import { MCPPromptCard } from "./mcp-prompt-card";
import { ConnectedAppsCard } from "./connected-apps-card";
import { STARTER_PROMPTS, MCP_PROMPT_GUIDE_URL } from "@/lib/mcp-constants";

export function MCPSettings() {
  return (
    <div className="mx-auto flex min-h-full max-w-[960px] flex-col gap-7 px-6 py-10">
      <SettingsPageHeader
        title="Connect AI assistants"
        description="Run your Lynq & Flow workspace straight from Claude or ChatGPT — look up tickets, refine Emma’s instructions and draft help articles right inside the chat."
      />

      <MCPEndpointCard />

      <ConnectedAppsCard />

      <section className="flex flex-col gap-3.5">
        <h2 className="text-lg font-semibold text-foreground">Starter prompts</h2>
        <div className="grid grid-cols-2 gap-4">
          {STARTER_PROMPTS.map((prompt) => (
            <MCPPromptCard key={prompt.title} prompt={prompt} />
          ))}
        </div>
      </section>

      <a
        href={MCP_PROMPT_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-[7px] text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
      >
        See the full prompt guide
        <ExternalLink size={16} strokeWidth={1.75} />
      </a>
    </div>
  );
}
