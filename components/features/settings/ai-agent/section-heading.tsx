/**
 * Standalone section heading for the AI-agent Rules page — Figma "18 Bold"
 * title over a medium-weight description (nodes 1068-23 / 1068-54 / 1068-108).
 */
export function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="text-sm font-medium text-muted-foreground">{description}</p>
    </div>
  )
}
