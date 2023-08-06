import React, { ReactNode } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

type TabsProps = {
  tabs: {
    title: ReactNode;
    content: ReactNode;
  }[];
};

export function Tabs({ tabs }: TabsProps) {
  return (
    <TabsPrimitive.Root defaultValue="t-0">
      <TabsPrimitive.List className="flex h-6 rounded-t-[4px] bg-slatedark3">
        {tabs.map(({ title }, i) => {
          const key = `t-${i}`;
          return (
            <TabsPrimitive.Trigger
              key={key}
              className="flex-1 select-none rounded-t-[4px] text-sm font-semibold text-slatedark12 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-bluedark8 data-[state=active]:bg-slatedark5"
              value={key}
            >
              {title}
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>
      {tabs.map(({ content }, i) => {
        const key = `t-${i}`;
        return (
          <TabsPrimitive.Content key={key} value={key} className="outline-none">
            {content}
          </TabsPrimitive.Content>
        );
      })}
    </TabsPrimitive.Root>
  );
}
