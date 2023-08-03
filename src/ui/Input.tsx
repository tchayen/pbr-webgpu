import React, { ComponentProps } from "react";

export function Input(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className="text-right w-full text-slatedark12 placeholder:text-slatedark9 text-sm px-3 h-7 rounded-[4px] bg-slatedark1 focus:ring-1 focus:outline-none focus:ring-bluedark8"
    />
  );
}
