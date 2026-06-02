"use client";
import React from "react";

export type McButtonVariant =
  | "default" | "primary" | "success" | "warning" | "danger" | "info" | "grape";
export type McButtonSize = "sm" | "md" | "lg";

interface McButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: McButtonVariant;
  size?: McButtonSize;
  /** トグルボタンの押下状態（押し込まれた見た目） */
  active?: boolean;
  icon?: React.ReactNode;
}

export function McButton({
  variant = "default",
  size = "md",
  active,
  icon,
  className = "",
  children,
  ...rest
}: McButtonProps) {
  const cls = [
    "mc-btn",
    variant !== "default" && `mc-btn--${variant}`,
    size !== "md" && `mc-btn--${size}`,
    className,
  ].filter(Boolean).join(" ");

  return (
    <button className={cls} data-active={active ? "true" : undefined} {...rest}>
      {icon}
      {children}
    </button>
  );
}
