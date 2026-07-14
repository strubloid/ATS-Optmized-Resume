import type { InputHTMLAttributes, PropsWithChildren, TextareaHTMLAttributes } from "react";

interface FieldProps {
  label: string;
  helper?: string;
}

export function TextField({ label, helper, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

export function TextAreaField({ label, helper, ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea {...props} />
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

export function Panel({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <section className={`panel ${className}`}>{children}</section>;
}
