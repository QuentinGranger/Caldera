import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Admin.module.scss';
export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      {label}
      <input {...props} />
    </label>
  );
}
export function SelectField({
  label,
  name,
  defaultValue,
  children,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={defaultValue} required={required}>
        {children}
      </select>
    </label>
  );
}
export function TextField({
  label,
  name,
  defaultValue,
  maxLength = 2000,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  maxLength?: number;
}) {
  return (
    <label className={styles.full}>
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue ?? ''}
        maxLength={maxLength}
      />
    </label>
  );
}
export function Check({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <label>
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}
export function Hidden({
  name,
  value,
}: {
  name: string;
  value: string | number;
}) {
  return <input type="hidden" name={name} value={value} />;
}
