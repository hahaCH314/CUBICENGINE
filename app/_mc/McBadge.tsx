"use client";
import React from "react";

export type McBadgeVariant =
  | "default" | "magenta" | "aqua" | "sun" | "grape" | "emerald" | "spectrum";

interface McBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: McBadgeVariant;
}

export function McBadge({
  variant = "default",
  className = "",
  children,
  ...rest
}: McBadgeProps) {
  const cls = [
    "mc-badge",
    variant !== "default" && `mc-badge--${variant}`,
    className,
  ].filter(Boolean).join(" ");

  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
