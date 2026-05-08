"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-1.5 text-sm leading-tight font-semibold select-none [&>[data-required]]:text-destructive [&>[data-required]]:font-bold group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function RequiredMark({ className }: { className?: string }) {
  return (
    <span
      data-required
      aria-label="必須"
      className={cn("text-destructive font-bold", className)}
    >
      *
    </span>
  )
}

export { Label, RequiredMark }
