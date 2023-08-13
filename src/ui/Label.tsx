import React, { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export function Label({
  className,
  children,
  ...rest
}: ComponentProps<"label">) {
  return (
    <label
      className={twMerge(
        "whitespace-nowrap text-sm text-slatedark9",
        rest.htmlFor && "cursor-pointer",
        className,
      )}
      {...rest}
    >
      {children}
    </label>
  );
}
