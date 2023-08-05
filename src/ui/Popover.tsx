import React, { ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { twMerge } from "tailwind-merge";

type PopoverProps = {
  trigger: ReactNode;
  content: ReactNode;
  className?: string;
};

export function Popover({ trigger, content, className }: PopoverProps) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className={twMerge(
            "rounded-[4px] bg-slatedark5 shadow-lg",
            className,
          )}
        >
          {content}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
