import React, { ComponentProps, ReactNode } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

export function Root(props: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className="flex h-7 w-full" {...props} />;
}

type RadioGroupItemProps = {
  value: string;
  children: ReactNode;
};

export function Item({ value, children }: RadioGroupItemProps) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      className="flex-1 bg-slatedark6 px-3 text-sm text-slatedark12 outline-none first:rounded-l-[4px] last:rounded-r-[4px] hover:bg-slatedark7 data-[state=checked]:bg-bluedark8"
    >
      {children}
    </RadioGroupPrimitive.Item>
  );
}
