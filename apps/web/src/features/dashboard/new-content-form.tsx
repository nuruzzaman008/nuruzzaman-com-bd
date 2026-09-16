'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { slugify } from '@/lib/slug';

/**
 * "New article" and "New product": a title, the address it will live at, and
 * straight into the editor.
 *
 * Nothing else is asked here on purpose. An article is created as an empty
 * draft - the writing, the picture, the SEO and the publishing all belong to
 * the editor, which opens as soon as the record exists.
 */
export type NewContentKind = 'post' | 'product';

/** The kinds of product the shop sells; a course listing is made under Courses. */
const PRODUCT_TYPES = ['software_license', 'credit_refill', 'bundle', 'digital_resource'] as const;

export function NewContentForm({ kind }: { kind: NewContentKind }) {
  const { t } = useLocale();
  const router = useRouter();
  const words = t.admin.newContent;
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [type, setType] = useState<string>(PRODUCT_TYPES[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const address = (slugEdited ? slug : slugify(title)).trim();

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(kind === 'post' ? words.titleNeeded : words.nameNeeded);

      return;
    }

    // A Bengali title gives no Latin slug, so the address has to be typed.
    if (!address) {
      setError(words.slugNeeded);

      return;
    }

    setSaving(true);

    try {
      const path = kind === 'post' ? '/admin/posts' : '/admin/products';
      const body =
        kind === 'post'
          ? { title: title.trim(), slug: address, body_markdown: '' }
          : { name: title.trim(), slug: address, type };

      const response = await api<{ data: { id?: number } }>(path, { method: 'POST', body });
      const id = response.data.id;

      router.push(
        id
          ? `/dashboard/${kind === 'post' ? 'posts' : 'products'}/${id}`
          : `/dashboard/${kind === 'post' ? 'posts' : 'products'}`,
      );
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : '';
      setError(reason ? `${words.failed} ${reason}` : words.failed);
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={create}
      // The browser's own message cannot say why a Bengali title makes no
      // address; the messages below can, so validation is ours.
      noValidate
      className="max-w-xl space-y-5"
      aria-label={words.heading[kind]}
    >
      <Field label={kind === 'post' ? t.admin.common.title : t.admin.common.name} required>
        {(props) => (
          <Input
            {...props}
            value={title}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
          />
        )}
      </Field>

      <Field label={t.admin.common.slug} hint={words.slugHint} required>
        {(props) => (
          <Input
            {...props}
            value={address}
            inputMode="url"
            className="font-latin"
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(slugify(event.target.value));
            }}
          />
        )}
      </Field>

      {kind === 'product' ? (
        <Field label={t.admin.common.type} required>
          {(props) => (
            <Select {...props} value={type} onChange={(event) => setType(event.target.value)}>
              {PRODUCT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t.admin.productTypes[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={saving}>
        {saving ? words.creating : words.create}
      </Button>
    </form>
  );
}
