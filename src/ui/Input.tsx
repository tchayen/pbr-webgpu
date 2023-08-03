import React, { ComponentProps } from "react";

export function Input(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className="h-7 w-full rounded-[4px] bg-slatedark1 px-3 text-right text-sm text-slatedark12 placeholder:text-slatedark9 focus:outline-none focus:ring-1 focus:ring-bluedark8"
    />
  );
}
