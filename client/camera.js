/**
 * Spring Camera Hook with Physics, Inertia Panning, and Focal Wheel Zoom
 */

import { useRef, useCallback, useEffect } from 'react'
import { SPRING_SOFT } from './util.js'

export function useCamera(stageRef, worldRef) {
  const cam = useRef({
    x: 0,
    y: 0,
    s: 1,
    vx: 0,
    vy: 0,
    vs: 0,
    tx: 0,
    ty: 0,
    ts: 1,
    raf: 0,
    stiffness: 90,
    damping: 17,
  })

  const apply = useCallback(() => {
    const c = cam.current
    const world = worldRef.current
    const stage = stageRef.current
    if (!world || !stage) return
    world.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) scale(${c.s})`
    world.style.setProperty('--px', `${c.x / c.s}px`)
    world.style.setProperty('--py', `${c.y / c.s}px`)
    stage.style.setProperty('--grid-x', `${c.x}px`)
    stage.style.setProperty('--grid-y', `${c.y}px`)
    stage.style.setProperty('--grid-size', `${28 * c.s}px`)
  }, [stageRef, worldRef])

  const tick = useCallback(() => {
    const c = cam.current
    const k = c.stiffness ?? 90
    const d = c.damping ?? 17
    const dt = 1 / 60
    c.vx += (k * (c.tx - c.x) - d * c.vx) * dt
    c.vy += (k * (c.ty - c.y) - d * c.vy) * dt
    c.vs += (k * (c.ts - c.s) - d * c.vs) * dt
    c.x += c.vx * dt
    c.y += c.vy * dt
    c.s += c.vs * dt
    apply()
    const idle =
      Math.abs(c.tx - c.x) < 0.2 &&
      Math.abs(c.ty - c.y) < 0.2 &&
      Math.abs(c.ts - c.s) < 0.0005 &&
      Math.abs(c.vx) + Math.abs(c.vy) < 0.5
    if (idle) {
      Object.assign(c, { x: c.tx, y: c.ty, s: c.ts, vx: 0, vy: 0, vs: 0, raf: 0 })
      apply()
      return
    }
    c.raf = requestAnimationFrame(tick)
  }, [apply])

  const flyTo = useCallback(
    (target, { instant = false, stiffness = 90, damping = 17 } = {}) => {
      const c = cam.current
      Object.assign(c, {
        tx: target.x != null ? target.x : c.tx,
        ty: target.y != null ? target.y : c.ty,
        ts: target.s != null ? target.s : c.ts,
        stiffness,
        damping,
      })
      if (instant) {
        cancelAnimationFrame(c.raf)
        Object.assign(c, { x: c.tx, y: c.ty, s: c.ts, vx: 0, vy: 0, vs: 0, raf: 0 })
        apply()
        return
      }
      if (!c.raf) c.raf = requestAnimationFrame(tick)
    },
    [apply, tick]
  )

  const halt = useCallback(() => {
    const c = cam.current
    cancelAnimationFrame(c.raf)
    Object.assign(c, { raf: 0, vx: 0, vy: 0, vs: 0, tx: c.x, ty: c.y, ts: c.s })
  }, [])

  const zoomAt = useCallback(
    (factor, cx, cy, instant = true) => {
      const c = cam.current
      const s = Math.max(0.3, Math.min(2.4, c.ts * factor))
      const k = s / c.ts
      flyTo(
        { x: cx - (cx - c.tx) * k, y: cy - (cy - c.ty) * k, s },
        { instant, stiffness: 160, damping: 24 }
      )
    },
    [flyTo]
  )

  useEffect(() => () => cancelAnimationFrame(cam.current.raf), [])

  return { cam, flyTo, halt, zoomAt, apply }
}
