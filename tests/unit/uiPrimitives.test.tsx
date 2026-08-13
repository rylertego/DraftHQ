import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EmptyState,
  Field,
  Input,
  Progress,
  StatusBadge,
  Tabs,
  TeamMark,
} from "@/components/ui";

describe("shared UI primitive contracts", () => {
  it("associates field help and errors with its control", () => {
    const html = renderToStaticMarkup(
      <Field label="Team name" description="Shown on draft night" error="Enter a team name" required>
        <Input name="teamName" />
      </Field>,
    );

    expect(html).toContain("required");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/aria-describedby="[^"]+ [^"]+"/);
    expect(html).toContain("Enter a team name");
  });

  it("renders an accessible selected tab and counter", () => {
    const html = renderToStaticMarkup(
      <Tabs
        label="Draft settings"
        value="teams"
        onValueChange={() => undefined}
        tabs={[
          { id: "general", label: "General" },
          { id: "teams", label: "Teams", count: 12 },
        ]}
      />,
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("12");
  });

  it("keeps status and progress explicit in text", () => {
    const html = renderToStaticMarkup(
      <>
        <StatusBadge status="success">Ready</StatusBadge>
        <Progress label="Player import" value={7} max={10} valueLabel="7 of 10 players" />
      </>,
    );

    expect(html).toContain("Ready");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuetext="7 of 10 players"');
    expect(html).toContain("7 of 10 players");
  });

  it("provides identity and empty-state fallbacks without implicit framing", () => {
    const html = renderToStaticMarkup(
      <>
        <TeamMark name="Philadelphia Phantoms" />
        <EmptyState title="No teams yet" description="Add the first team to set the draft order." />
      </>,
    );

    expect(html).toContain("PP");
    expect(html).not.toContain("data-framed=\"true\"");
    expect(html).toContain("No teams yet");
    expect(html).toContain("Add the first team");
  });
});
