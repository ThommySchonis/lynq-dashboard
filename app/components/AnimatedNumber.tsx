'use client'

import { useEffect, useRef } from 'react'
import { animate } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
}

export default function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) {
          const formatted = decimals > 0
            ? v.toFixed(decimals)
            : Math.round(v).toLocaleString()
          ref.current.textContent = `${prefix}${formatted}${suffix}`
        }
      },
    })
    return controls.stop
  }, [value, prefix, suffix, decimals])

  return (
    <span ref={ref}>
      {prefix}0{suffix}
    </span>
  )
}
