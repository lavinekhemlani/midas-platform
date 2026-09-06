'use client'

import { RefObject, useEffect, useId, useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

export interface AnimatedBeamProps {
  className?: string
  containerRef: RefObject<HTMLElement | null>
  fromRef: RefObject<HTMLElement | null>
  toRef: RefObject<HTMLElement | null>
  curvature?: number
  reverse?: boolean
  pathColor?: string
  pathWidth?: number
  pathOpacity?: number
  gradientStartColor?: string
  gradientStopColor?: string
  delay?: number
  duration?: number
  startXOffset?: number
  startYOffset?: number
  endXOffset?: number
  endYOffset?: number
  pathType?: 'curved' | 'step'
  stepJunctionY?: number // fraction of container height (0-1), used when pathType is 'step'
}

export const AnimatedBeam: React.FC<AnimatedBeamProps> = ({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = Math.random() * 3 + 4,
  delay = 0,
  pathColor = 'gray',
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = '#ffaa40',
  gradientStopColor = '#9c40ff',
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
  pathType = 'curved',
  stepJunctionY,
}) => {
  const id = useId()
  const [pathD, setPathD] = useState('')
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 })

  // Store the actual start/end points for the gradient
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 })
  const [endPoint, setEndPoint] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const updatePath = () => {
      if (containerRef.current && fromRef.current && toRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const rectA = fromRef.current.getBoundingClientRect()
        const rectB = toRef.current.getBoundingClientRect()

        const svgWidth = containerRect.width
        const svgHeight = containerRect.height
        setSvgDimensions({ width: svgWidth, height: svgHeight })

        const startX = rectA.left - containerRect.left + rectA.width / 2 + startXOffset
        const startY = rectA.top - containerRect.top + rectA.height / 2 + startYOffset
        const endX = rectB.left - containerRect.left + rectB.width / 2 + endXOffset
        const endY = rectB.top - containerRect.top + rectB.height / 2 + endYOffset

        let d: string
        if (pathType === 'step' && stepJunctionY !== undefined) {
          const juncY = svgHeight * stepJunctionY
          // Smooth cubic bezier: flows down from start, sweeps across, arrives from above at end
          d = `M ${startX},${startY} C ${startX},${juncY} ${endX},${juncY} ${endX},${endY}`
        } else {
          const controlY = startY - curvature
          d = `M ${startX},${startY} Q ${(startX + endX) / 2},${controlY} ${endX},${endY}`
        }
        setPathD(d)

        // Store the start and end points
        setStartPoint({ x: startX, y: startY })
        setEndPoint({ x: endX, y: endY })
      }
    }

    // Initialize ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      updatePath()
    })

    // Observe the container element
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Call the updatePath initially to set the initial path
    updatePath()

    // Clean up the observer on component unmount
    return () => {
      resizeObserver.disconnect()
    }
  }, [containerRef, fromRef, toRef, curvature, startXOffset, startYOffset, endXOffset, endYOffset, pathType, stepJunctionY])

  // Don't render until we have valid dimensions
  if (svgDimensions.width === 0 || svgDimensions.height === 0) {
    return null
  }

  // Calculate gradient animation coordinates
  // The gradient needs to move along the path direction
  const dx = endPoint.x - startPoint.x
  const dy = endPoint.y - startPoint.y
  const length = Math.sqrt(dx * dx + dy * dy) || 1

  // Normalize direction
  const nx = dx / length
  const ny = dy / length

  // Extend the gradient beyond the path for smooth entry/exit
  const extension = length * 0.8

  // Calculate animation keyframes based on direction
  // For reverse=false: animate FROM the fromRef TO the toRef (into center)
  // The gradient "start" position is before the fromRef, "end" is past the toRef
  let x1Start: number, y1Start: number, x1End: number, y1End: number
  let x2Start: number, y2Start: number, x2End: number, y2End: number

  if (reverse) {
    // Animate from toRef to fromRef
    x1Start = endPoint.x + nx * extension
    y1Start = endPoint.y + ny * extension
    x1End = startPoint.x - nx * extension
    y1End = startPoint.y - ny * extension
    x2Start = endPoint.x + nx * (extension * 0.5)
    y2Start = endPoint.y + ny * (extension * 0.5)
    x2End = startPoint.x - nx * (extension * 0.5)
    y2End = startPoint.y - ny * (extension * 0.5)
  } else {
    // Animate from fromRef to toRef (default - flowing INTO the center)
    x1Start = startPoint.x - nx * extension
    y1Start = startPoint.y - ny * extension
    x1End = endPoint.x + nx * extension
    y1End = endPoint.y + ny * extension
    x2Start = startPoint.x - nx * (extension * 0.5)
    y2Start = startPoint.y - ny * (extension * 0.5)
    x2End = endPoint.x + nx * (extension * 0.5)
    y2End = endPoint.y + ny * (extension * 0.5)
  }

  return (
    <svg
      fill="none"
      width={svgDimensions.width}
      height={svgDimensions.height}
      xmlns="http://www.w3.org/2000/svg"
      className={cn('pointer-events-none absolute top-0 left-0 transform-gpu stroke-2', className)}
      viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
      style={{ overflow: 'visible' }}
    >
      <path
        d={pathD}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d={pathD}
        strokeWidth={pathWidth}
        stroke={`url(#${id})`}
        strokeOpacity="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <defs>
        <motion.linearGradient
          className="transform-gpu"
          id={id}
          gradientUnits="userSpaceOnUse"
          initial={{
            x1: x1Start,
            y1: y1Start,
            x2: x2Start,
            y2: y2Start,
          }}
          animate={{
            x1: x1End,
            y1: y1End,
            x2: x2End,
            y2: y2End,
          }}
          transition={{
            delay,
            duration,
            ease: 'linear',
            repeat: Infinity,
            repeatDelay: 0,
          }}
        >
          <stop stopColor={gradientStartColor} stopOpacity="0"></stop>
          <stop stopColor={gradientStartColor}></stop>
          <stop offset="32.5%" stopColor={gradientStopColor}></stop>
          <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0"></stop>
        </motion.linearGradient>
      </defs>
    </svg>
  )
}
