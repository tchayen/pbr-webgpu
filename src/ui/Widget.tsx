import React, { ComponentProps } from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

type WidgetProps = {
  title: string;
};

export function Widget({
  title,
  children,
  ...rest
}: WidgetProps & ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return (
    <CollapsiblePrimitive.Root className="w-80" defaultOpen {...rest}>
      <CollapsiblePrimitive.Trigger className="w-full flex items-center justify-between px-3 h-7 bg-slatedark6">
        <span className="text-sm text-slatedark12 font-medium">{title}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M0.5 5.5L8 12L15.5 5.5" stroke="#6B7176" />
        </svg>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content
        className="grid data-[state=closed]:p-0 items-center gap-2 p-3"
        style={{
          gridTemplateColumns: "min-content auto",
        }}
      >
        {children}
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
}
