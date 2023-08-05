import React, { ComponentProps } from "react";

export function Label({ children }: ComponentProps<"label">) {
  return (
    <label className="whitespace-nowrap text-sm text-slatedark9">
      {children}
    </label>
  );
}
