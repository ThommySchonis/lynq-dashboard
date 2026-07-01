/**
 * Decorative gradient-orb / ring / dot overlay used inside the lavender "cover"
 * of the Featured Card and the Article Modal. Positions mirror the Figma cover
 * (node 400:794 / 472:15088). Purely decorative — absolute, non-interactive.
 * The soft purple tints (#A175FC / #C4A0FF) are one-off decorative colors.
 */
export function CoverDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Large blurred fills */}
      <span className="absolute left-[470px] top-[-90px] size-[360px] rounded-full bg-[#8B5CF6]/[0.16] blur-[35px]" />
      <span className="absolute left-[560px] top-[30px] size-[220px] rounded-full bg-[#C4A0FF]/[0.55] blur-[9px]" />
      <span className="absolute left-[470px] top-[70px] size-[120px] rounded-full bg-[#A175FC]/50" />
      {/* Ring outlines */}
      <span className="absolute left-[150px] top-[90px] size-[150px] rounded-full border-[1.5px] border-[#A175FC]/45" />
      <span className="absolute left-[320px] top-[20px] size-[70px] rounded-full border-[1.5px] border-[#8B5CF6]/50" />
      {/* Small solid */}
      <span className="absolute left-[250px] top-[120px] size-[46px] rounded-full bg-[#C4A0FF]/60" />
      {/* Dot cluster */}
      <span className="absolute left-[80px] top-[132px] size-[7px] rounded-full bg-[#8B5CF6]/50" />
      <span className="absolute left-[100px] top-[150px] size-[7px] rounded-full bg-[#8B5CF6]/50" />
      <span className="absolute left-[80px] top-[168px] size-[7px] rounded-full bg-[#8B5CF6]/50" />
      <span className="absolute left-[60px] top-[150px] size-[7px] rounded-full bg-[#8B5CF6]/50" />
    </div>
  )
}
