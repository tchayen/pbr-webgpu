import React, { ComponentProps } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

export function Checkbox(props: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className="flex h-4 w-4 items-center justify-center rounded-sm bg-slatedark7 shadow-sm outline-none hover:bg-slatedark8 focus-visible:ring-1 focus-visible:ring-bluedark8 data-[state=checked]:bg-bluedark7"
      defaultChecked
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <svg
          width="14"
          height="10"
          viewBox="0 0 14 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 4.5L5.625 8.125L11.7578 1.875"
            stroke="#ECEDEE"
            strokeWidth="1.5"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
