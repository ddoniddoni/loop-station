import { Theme } from "@radix-ui/themes";
import type { ReactNode } from "react";

export function StudioTheme({ children }: { children: ReactNode }) {
  return (
    <Theme
      appearance="dark"
      accentColor="jade"
      grayColor="slate"
      panelBackground="solid"
      radius="medium"
      scaling="100%"
    >
      {children}
    </Theme>
  );
}
