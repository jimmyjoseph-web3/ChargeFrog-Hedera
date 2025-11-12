"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { ref, onValue, off, DataSnapshot } from "firebase/database"
import { db } from "../../lib/firebaseClient"

type ActiveChargeReminderProps = {
  walletAddress: string
}

export default function ActiveChargeReminder({ walletAddress }: ActiveChargeReminderProps) {
  const router = useRouter()
  const [activeCharge, setActiveCharge] = useState<any>(null)
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // ✅ Realtime Firebase listener
  useEffect(() => {
    if (!walletAddress) return
    const activeChargeRef = ref(db, `users/${walletAddress}/activeCharge`)
    const listener = (snapshot: DataSnapshot) => {
      const data = snapshot.val()
      setActiveCharge(data) // store the full data, not just true/false
    }
    onValue(activeChargeRef, listener)
    return () => off(activeChargeRef, "value", listener)
  }, [walletAddress])

  // ✅ Collapse when tapping outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    if (expanded) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [expanded])

  // 🧱 Hide completely if not active
  if (!activeCharge) return null

  return (
    <div
      ref={containerRef}
      className="fixed top-5 left-0 right-0 z-50 flex justify-center"
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={`overflow-hidden bg-black shadow-lg cursor-pointer ${
          expanded ? "mx-4 w-full rounded-4xl" : "w-fit rounded-full"
        }`}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <motion.div
          key={expanded ? "expanded" : "idle"}
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {expanded ? (
            <ActiveChargingView
              router={router}
              stationId={activeCharge.stationId}
            />
          ) : (
            <IdleView />
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}

// ⚡ Idle View — lightning icon only
function IdleView() {
  return (
    <motion.div
      layout
      className="flex items-center justify-center px-3 py-2"
    >
      <Image
        src="/map/bolt.png"
        alt="Charging Idle"
        width={28}
        height={28}
        className="object-contain"
      />
    </motion.div>
  )
}

// 🔋 Expanded Charging View
function ActiveChargingView({
  router,
  stationId,
}: {
  router: ReturnType<typeof useRouter>
  stationId?: string
}) {
  return (
    <div className="text-foreground flex w-full flex-col items-center overflow-hidden px-6 py-5">
      <div className="flex w-full items-center gap-3">
        <Image
          src="/map/bolt.png"
          alt="Charging"
          width={28}
          height={28}
          className="object-contain"
        />
        <div className="flex-1">
          <p className="pointer-events-none font-semibold text-md text-white">
            You have an active charging
          </p>
          <p className="pointer-events-none text-sm text-white opacity-70">
            {`ChargeFrog Station #${stationId ?? ""}`}
          </p>
        </div>
        <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
      </div>

      {/* 🚀 Navigate button */}
      <button
        onClick={(e) => {
          e.stopPropagation() // prevent closing
          router.push("/charging")
        }}
        className="mt-5 w-full rounded-xl bg-green-500 px-4 py-4 text-sm font-semibold text-white hover:bg-green-600 transition-colors"
      >
        Go to Charging
      </button>
    </div>
  )
}
