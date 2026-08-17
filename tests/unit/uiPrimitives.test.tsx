import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EmptyState,
  Dialog,
  Field,
  Input,
  Menu,
  Popover,
  Progress,
  Skeleton,
  StatusBadge,
  Tabs,
  TeamMark,
  Toast,
  type FieldProps,
  type InputProps,
  type MenuProps,
} from "@/components/ui";

// @ts-expect-error A non-idle Field state must always include explicit text.
const invalidFieldProps: FieldProps = { children: "control", label: "Name", state: "saving" };
// @ts-expect-error Active Field status messages must be textual, not arbitrary renderable content.
const invalidFieldNodeProps: FieldProps = { children: "control", label: "Name", state: "saved", stateMessage: <span>Saved</span> };
// @ts-expect-error Protected form controls do not expose raw native dimensions.
const invalidInputProps: InputProps = { width: 200, height: 40 };
// @ts-expect-error Overlay triggers are bounded text/icon content, not arbitrary interactive nodes.
const invalidMenuProps: MenuProps = { label: "Actions", trigger: <button>Nested</button>, items: [] };
// @ts-expect-error Trigger icons are closed semantic names, not arbitrary elements.
const invalidMenuIconProps: MenuProps = { label: "Actions", triggerIcon: <button>Nested</button>, items: [] };
const InvalidTriggerIcon = () => <button>Nested</button>;
// @ts-expect-error Trigger icons are closed semantic names, not caller-provided components.
const invalidMenuIconComponentProps: MenuProps = { label: "Actions", triggerIcon: InvalidTriggerIcon, items: [] };
void invalidFieldProps;
void invalidFieldNodeProps;
void invalidInputProps;
void invalidMenuProps;
void invalidMenuIconProps;
void invalidMenuIconComponentProps;

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

  it("falls back to an enabled tab and only emits explicit panel relationships", () => {
    const html = renderToStaticMarkup(
      <Tabs
        label="Draft settings"
        value="disabled"
        onValueChange={() => undefined}
        tabs={[
          { id: "disabled", label: "Disabled", disabled: true },
          { id: "general", label: "General" },
          { id: "teams", label: "Teams", panelId: "teams-panel" },
        ]}
      />,
    );

    expect(html).toMatch(/General<\/span><\/button>/);
    expect(html).toMatch(/aria-selected="true" tabindex="0"[^>]*><span>General/);
    expect(html.match(/aria-controls=/g)).toHaveLength(1);
    expect(html).toContain('aria-controls="teams-panel"');
  });

  it("preserves aria-invalid literals and requires explicit live Field state", () => {
    const html = renderToStaticMarkup(
      <>
        <Input aria-label="Grammar check" aria-invalid="grammar" />
        <Field label="League name" state="saving" stateMessage="Saving league name">
          <Input />
        </Field>
      </>,
    );

    expect(html).toContain('aria-invalid="grammar"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Saving league name");
  });

  it("rejects blank active Field status text", () => {
    expect(() => renderToStaticMarkup(
      <Field label="League name" state="saving" stateMessage="   ">
        <Input />
      </Field>,
    )).toThrow("Field stateMessage must contain non-empty text");
  });

  it("renders one bounded trigger control without implicit nesting", () => {
    const html = renderToStaticMarkup(
      <Menu label="Team actions" triggerText="Actions" triggerIcon="more-horizontal" items={[]} />,
    );

    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Team actions"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Actions");
  });

  it("keeps initially open portals out of server markup for hydration", () => {
    const menuHtml = renderToStaticMarkup(
      <Menu label="Actions" triggerText="Actions" open items={[]} />,
    );
    const popoverHtml = renderToStaticMarkup(
      <Popover triggerLabel="Filters" triggerText="Filters" label="Filter options" open>
        Filter content
      </Popover>,
    );
    const toastHtml = renderToStaticMarkup(
      <Toast open onDismiss={() => undefined}>Saved</Toast>,
    );
    const dialogHtml = renderToStaticMarkup(
      <Dialog open onClose={() => undefined} title="Edit team">Dialog content</Dialog>,
    );

    expect(menuHtml).not.toContain('role="menu"');
    expect(popoverHtml).not.toContain('role="dialog"');
    expect(toastHtml).toBe("");
    expect(dialogHtml).toBe("");
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

  it("exposes bounded square and control skeleton geometry", () => {
    const html = renderToStaticMarkup(
      <>
        <Skeleton height="control" />
        <Skeleton height="mark-medium" shape="square" />
      </>,
    );

    expect(html).toContain('data-height="control"');
    expect(html).toContain('data-shape="square"');
  });
});
