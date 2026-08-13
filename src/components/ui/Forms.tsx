"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type Protected<T> = Omit<T, "className" | "color" | "size" | "style">;
type FieldState = "idle" | "saving" | "saved" | "error";

interface FieldContextValue {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

function joinIds(...ids: Array<string | undefined>) {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}

function useControlA11y(id?: string, describedBy?: string, invalid?: boolean, required?: boolean) {
  const generatedId = useId();
  const field = useContext(FieldContext);

  return {
    id: id ?? field?.controlId ?? generatedId,
    "aria-describedby": joinIds(describedBy, field?.describedBy),
    "aria-invalid": invalid || field?.invalid ? true : undefined,
    required: required ?? field?.required,
  };
}

export interface FieldProps {
  children: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  controlId?: string;
  state?: FieldState;
  stateMessage?: ReactNode;
}

export function Field({
  children,
  label,
  description,
  error,
  required = false,
  controlId,
  state = "idle",
  stateMessage,
}: FieldProps) {
  const generatedId = useId();
  const id = controlId ?? generatedId;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const statusId = state !== "idle" && stateMessage ? `${id}-status` : undefined;
  const invalid = Boolean(error) || state === "error";

  return (
    <div className="ui-field" data-invalid={invalid || undefined}>
      <label className="ui-field__label" htmlFor={id}>
        {label}
        {required ? <span className="ui-field__required"> (required)</span> : null}
      </label>
      {description ? (
        <span className="ui-field__description" id={descriptionId}>
          {description}
        </span>
      ) : null}
      <FieldContext.Provider
        value={{
          controlId: id,
          describedBy: joinIds(descriptionId, errorId, statusId),
          invalid,
          required,
        }}
      >
        {children}
      </FieldContext.Provider>
      {error ? (
        <span className="ui-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
      {state !== "idle" && stateMessage ? (
        <span
          className="ui-field__status"
          data-state={state}
          id={statusId}
          role={state === "error" ? "alert" : "status"}
        >
          {stateMessage}
        </span>
      ) : null}
    </div>
  );
}

export type InputProps = Protected<InputHTMLAttributes<HTMLInputElement>>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, "aria-describedby": describedBy, "aria-invalid": invalid, required, ...props },
  ref,
) {
  const a11y = useControlA11y(id, describedBy, Boolean(invalid), required);
  return <input {...props} {...a11y} ref={ref} className="ui-form-control ui-input" />;
});

export type SelectProps = Protected<SelectHTMLAttributes<HTMLSelectElement>>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id, "aria-describedby": describedBy, "aria-invalid": invalid, required, children, ...props },
  ref,
) {
  const a11y = useControlA11y(id, describedBy, Boolean(invalid), required);
  return (
    <select {...props} {...a11y} ref={ref} className="ui-form-control ui-select">
      {children}
    </select>
  );
});

export type TextareaProps = Omit<Protected<TextareaHTMLAttributes<HTMLTextAreaElement>>, "cols" | "rows"> & {
  rows?: 3 | 4 | 6 | 8;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id, "aria-describedby": describedBy, "aria-invalid": invalid, required, ...props },
  ref,
) {
  const a11y = useControlA11y(id, describedBy, Boolean(invalid), required);
  return <textarea {...props} {...a11y} ref={ref} className="ui-form-control ui-textarea" />;
});

interface ChoiceProps
  extends Omit<Protected<InputHTMLAttributes<HTMLInputElement>>, "type" | "children" | "role"> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

function Choice({ type, role, label, description, error, id, ...props }: ChoiceProps & {
  type: "checkbox" | "radio";
  role?: "switch";
}) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <div className="ui-choice-field" data-invalid={Boolean(error) || undefined}>
      <label className="ui-choice" htmlFor={controlId}>
        <input
          {...props}
          id={controlId}
          type={type}
          role={role}
          aria-describedby={joinIds(props["aria-describedby"], descriptionId, errorId)}
          aria-invalid={error ? true : props["aria-invalid"]}
          className="ui-choice__input"
        />
        <span className="ui-choice__control" aria-hidden="true" />
        <span className="ui-choice__copy">
          <span className="ui-choice__label">
            {label}
            {props.required ? <span className="ui-field__required"> (required)</span> : null}
          </span>
          {description ? (
            <span className="ui-choice__description" id={descriptionId}>
              {description}
            </span>
          ) : null}
        </span>
      </label>
      {error ? (
        <span className="ui-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export type CheckboxProps = ChoiceProps;
export function Checkbox(props: CheckboxProps) {
  return <Choice {...props} type="checkbox" />;
}

export type RadioProps = ChoiceProps;
export function Radio(props: RadioProps) {
  return <Choice {...props} type="radio" />;
}

export type SwitchProps = ChoiceProps;
export function Switch(props: SwitchProps) {
  return <Choice {...props} type="checkbox" role="switch" />;
}

export interface StepperProps
  extends Omit<Protected<InputHTMLAttributes<HTMLInputElement>>, "defaultValue" | "onChange" | "type" | "value"> {
  value: number;
  onValueChange: (value: number) => void;
  decrementLabel?: string;
  incrementLabel?: string;
}

export function Stepper({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  disabled,
  decrementLabel = "Decrease value",
  incrementLabel = "Increase value",
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  required,
  ...props
}: StepperProps) {
  const a11y = useControlA11y(id, describedBy, Boolean(invalid), required);
  const numericStep = typeof step === "number" ? step : Number(step) || 1;

  function update(next: number) {
    onValueChange(Math.min(Number(max ?? Infinity), Math.max(Number(min ?? -Infinity), next)));
  }

  return (
    <div className="ui-stepper">
      <button
        type="button"
        className="ui-stepper__button"
        aria-label={decrementLabel}
        disabled={disabled || (min !== undefined && value <= Number(min))}
        onClick={() => update(value - numericStep)}
      >
        <span aria-hidden="true">-</span>
      </button>
      <input
        {...props}
        {...a11y}
        type="number"
        className="ui-form-control ui-stepper__input"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          if (Number.isFinite(event.currentTarget.valueAsNumber)) onValueChange(event.currentTarget.valueAsNumber);
        }}
      />
      <button
        type="button"
        className="ui-stepper__button"
        aria-label={incrementLabel}
        disabled={disabled || (max !== undefined && value >= Number(max))}
        onClick={() => update(value + numericStep)}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

export interface FileUploadProps
  extends Omit<Protected<InputHTMLAttributes<HTMLInputElement>>, "children" | "type"> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  emptyText?: string;
}

export function FileUpload({
  label,
  description,
  error,
  emptyText = "No file selected",
  id,
  onChange,
  ...props
}: FileUploadProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [fileName, setFileName] = useState(emptyText);
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const names = Array.from(event.currentTarget.files ?? [], (file) => file.name);
    setFileName(names.length ? names.join(", ") : emptyText);
    onChange?.(event);
  }

  return (
    <div className="ui-field" data-invalid={Boolean(error) || undefined}>
      <span className="ui-field__label">
        {label}
        {props.required ? <span className="ui-field__required"> (required)</span> : null}
      </span>
      {description ? <span className="ui-field__description" id={descriptionId}>{description}</span> : null}
      <div className="ui-file-upload">
        <input
          {...props}
          id={controlId}
          type="file"
          className="ui-file-upload__input"
          aria-describedby={joinIds(props["aria-describedby"], descriptionId, errorId)}
          aria-invalid={error ? true : props["aria-invalid"]}
          onChange={handleChange}
        />
        <label className="ui-file-upload__button" htmlFor={controlId}>Choose file</label>
        <span className="ui-file-upload__name" aria-live="polite">{fileName}</span>
      </div>
      {error ? <span className="ui-field__error" id={errorId} role="alert">{error}</span> : null}
    </div>
  );
}

export interface ColorControlProps
  extends Omit<Protected<InputHTMLAttributes<HTMLInputElement>>, "children" | "onChange" | "type" | "value"> {
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  description?: ReactNode;
  error?: ReactNode;
}

export function ColorControl({
  label,
  value,
  onValueChange,
  description,
  error,
  id,
  disabled,
  ...props
}: ColorControlProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = joinIds(props["aria-describedby"], descriptionId, errorId);

  return (
    <div className="ui-field" data-invalid={Boolean(error) || undefined}>
      <label className="ui-field__label" htmlFor={`${controlId}-text`}>
        {label}
        {props.required ? <span className="ui-field__required"> (required)</span> : null}
      </label>
      {description ? <span className="ui-field__description" id={descriptionId}>{description}</span> : null}
      <div className="ui-color-control">
        <input
          id={`${controlId}-swatch`}
          type="color"
          className="ui-color-control__swatch"
          value={value}
          disabled={disabled}
          aria-label={`${typeof label === "string" ? label : "Color"} picker`}
          aria-describedby={describedBy}
          onChange={(event) => onValueChange(event.currentTarget.value.toUpperCase())}
        />
        <input
          {...props}
          id={`${controlId}-text`}
          className="ui-form-control ui-color-control__text"
          value={value}
          disabled={disabled}
          spellCheck={false}
          inputMode="text"
          pattern="#[0-9A-Fa-f]{6}"
          aria-describedby={describedBy}
          aria-invalid={error ? true : props["aria-invalid"]}
          onChange={(event) => onValueChange(event.currentTarget.value.toUpperCase())}
        />
      </div>
      {error ? <span className="ui-field__error" id={errorId} role="alert">{error}</span> : null}
    </div>
  );
}
