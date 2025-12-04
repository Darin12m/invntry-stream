"use client";

import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels"; // Corrected imports

import { cn } from "@/utils/cn";

const ResizablePanelGroupRoot = PanelGroup;

const ResizablePanelRoot = Panel;

const ResizableHandleRoot = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof PanelResizeHandle> & { // Corrected type
  withHandle?: boolean;
}) => (
  <PanelResizeHandle // Corrected component name
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:top-1/2 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2",
      withHandle &&
        "after:bg-border after:opacity-0 hover:after:opacity-100 focus-visible:after:opacity-100 focus-visible:ring-offset-background data-[panel-group-direction=vertical]:after:bg-border data-[panel-group-direction=vertical]:hover:after:opacity-100 data-[panel-group-direction=vertical]:focus-visible:after:opacity-100",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-2.5 w-2.5"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path stroke="none" d="M0 0h24v24H0z" />
          <path d="M10 9L8 12l2 3" />
          <path d="M14 9l2 3-2 3" />
        </svg>
      </div>
    )}
  </PanelResizeHandle>
);

export {
  ResizablePanelGroupRoot as ResizablePanelGroup,
  ResizablePanelRoot as ResizablePanel,
  ResizableHandleRoot as ResizableHandle,
};