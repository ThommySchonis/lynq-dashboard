/** Author by-line (avatar + name + org) shared by the featured card and modal. */
export function AuthorByline({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span aria-hidden="true" className="size-8 shrink-0 rounded-full bg-black/[0.14]" />
      <div className="flex flex-col gap-px">
        <span className="text-sm font-semibold leading-5 text-foreground">{name}</span>
        <span className="text-xs leading-4 text-foreground-4">Lynq &amp; Flow</span>
      </div>
    </div>
  )
}
