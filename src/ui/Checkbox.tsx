import React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

type CheckboxProps = {
  value: "on" | "off";
};

export function Checkbox({ value }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className="flex h-4 w-4 items-center justify-center rounded-sm bg-slatedark1 outline-none focus:ring-1 focus:ring-bluedark8 focus:ring-offset-2 focus:ring-offset-slatedark4 data-[state=checked]:bg-bluedark8"
      defaultChecked
      id="c1"
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
