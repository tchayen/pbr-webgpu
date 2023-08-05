import React, { ComponentProps, ReactNode } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

export function Root(props: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      className="flex h-6 w-full shadow-sm"
      {...props}
    />
  );
}

type RadioGroupItemProps = {
  value: string;
  children: ReactNode;
};

export function Item({ value, children }: RadioGroupItemProps) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      className="flex-1 bg-slatedark7 from-bluedark8 to-bluedark7 px-2 text-sm font-medium text-slatedark12 outline-none first:rounded-l-[4px] last:rounded-r-[4px] hover:bg-slatedark8 data-[state=checked]:bg-bluedark8 data-[state=checked]:bg-gradient-to-b"
    >
      {children}
    </RadioGroupPrimitive.Item>
  );
}
