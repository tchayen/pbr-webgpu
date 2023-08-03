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
      className="hover:bg-slatedark7 flex-1 px-3 bg-slatedark6 text-slatedark12 text-sm data-[state=checked]:bg-bluedark8 first:rounded-l-[4px] last:rounded-r-[4px]"
    >
      {children}
    </RadioGroupPrimitive.Item>
  );
}
