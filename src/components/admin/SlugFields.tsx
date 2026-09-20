'use client';
import { useState } from 'react';
import { createSlug } from '@/lib/catalog/createSlug';
export function SlugFields({
  name = '',
  slug = '',
}: {
  name?: string;
  slug?: string;
}) {
  const [value, setValue] = useState(slug);
  const [manual, setManual] = useState(Boolean(slug));
  return (
    <>
      <label>
        Nom
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={name}
          onChange={(event) => {
            if (!manual) setValue(createSlug(event.target.value));
          }}
        />
      </label>
      <label>
        Slug
        <input
          name="slug"
          maxLength={180}
          value={value}
          onChange={(event) => {
            setManual(Boolean(event.target.value));
            setValue(event.target.value);
          }}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
        />
        <small>Adresse lisible, sans accent ni espace.</small>
      </label>
    </>
  );
}
