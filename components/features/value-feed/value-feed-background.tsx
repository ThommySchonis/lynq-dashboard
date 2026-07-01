/**
 * Page-level decorative background orbs for the Value Feed (Figma nodes
 * 488:7129–488:7132). Soft blurred purple ellipses at low opacity over the
 * white page. Absolute, non-interactive, sits behind the content.
 */
export function ValueFeedBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute right-[-60px] top-[-60px] size-[380px] rounded-full bg-[#A175FC]/[0.12] blur-[45px]" />
      <span className="absolute left-[-170px] top-[820px] size-[320px] rounded-full bg-[#8B5CF6]/10 blur-[45px]" />
      <span className="absolute right-[40px] top-[1500px] size-[340px] rounded-full bg-[#C4A0FF]/[0.14] blur-[45px]" />
      <span className="absolute left-[-150px] top-[1900px] size-[280px] rounded-full bg-[#A175FC]/10 blur-[45px]" />
    </div>
  )
}
