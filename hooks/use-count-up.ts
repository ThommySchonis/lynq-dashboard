'use client'

import { useState, useEffect } from 'react'

/**
 * Animates a number from 0 to `end` over `duration` ms.
 * Used in KPI cards for a count-up effect.
 */
export function useCountUp(end: number, duration = 1200): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!end || end === 0) {
      setCount(0) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }
    let start = 0
    const step = end / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [end, duration])

  return count
}
