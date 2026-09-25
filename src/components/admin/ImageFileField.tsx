'use client';
import { Field } from './AdminFields';
export function ImageFileField({
  maxBytes,
  maxLabel,
}: {
  maxBytes: number;
  maxLabel: string;
}) {
  return (
    <Field
      label="Fichier image"
      name="file"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      required
      onChange={(event) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        input.setCustomValidity(
          file && file.size > maxBytes
            ? `Image trop lourde : ${maxLabel} maximum.`
            : '',
        );
        input.reportValidity();
      }}
    />
  );
}
