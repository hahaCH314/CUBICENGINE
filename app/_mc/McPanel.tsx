"use client";
import React from "react";

interface McPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** 上端にタイトルバーを表示（任意） */
  title?: React.ReactNode;
  /** body の padding をオフ（自前で詰める場合） */
  bare?: boolean;
}

export function McPanel({
  title,
  bare,
  className = "",
  children,
  ...rest
}: McPanelProps) {
  return (
    <div className={`mc-panel ${className}`} {...rest}>
      {title && <div className="mc-panel__title">{title}</div>}
      <div className={bare ? "" : "mc-panel__body"}>{children}</div>
    </div>
  );
}
