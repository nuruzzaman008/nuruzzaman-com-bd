'use client';

import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import type { MediaDetail } from '@/features/dashboard/media-filters';
import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/locale-provider';

export type Crop = { x: number; y: number; width: number; height: number };

export type ImageEdit = {
  rotate: 0 | 90 | 180 | 270;
  flip_horizontal: boolean;
  flip_vertical: boolean;
  /** In the pixels of the image after flip and rotate. */
  crop: Crop | null;
  scale_width: number | null;
};

const NO_EDIT: ImageEdit = {
  rotate: 0,
  flip_horizontal: false,
  flip_vertical: false,
  crop: null,
  scale_width: null,
};

const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 460;
const MIN_CROP = 10;

/** The image's size once turned - the space a crop is drawn in. */
export function turnedSize(width: number, height: number, rotate: number) {
  return rotate % 180 === 0 ? { width, height } : { width: height, height: width };
}

/** What the edit produces, the same way the API works it out. */
export function editedSize(width: number, height: number, edit: ImageEdit) {
  const turned = turnedSize(width, height, edit.rotate);
  const cropped = edit.crop ? { width: edit.crop.width, height: edit.crop.height } : turned;

  if (edit.scale_width && edit.scale_width < cropped.width) {
    return {
      width: edit.scale_width,
      height: Math.max(1, Math.round((cropped.height * edit.scale_width) / cropped.width)),
    };
  }

  return cropped;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function moveCrop(
  crop: Crop,
  dx: number,
  dy: number,
  bounds: { width: number; height: number },
): Crop {
  return {
    ...crop,
    x: Math.round(clamp(crop.x + dx, 0, bounds.width - crop.width)),
    y: Math.round(clamp(crop.y + dy, 0, bounds.height - crop.height)),
  };
}

export function resizeCrop(
  crop: Crop,
  dx: number,
  dy: number,
  bounds: { width: number; height: number },
): Crop {
  return {
    ...crop,
    width: Math.round(
      clamp(crop.width + dx, Math.min(MIN_CROP, bounds.width - crop.x), bounds.width - crop.x),
    ),
    height: Math.round(
      clamp(crop.height + dy, Math.min(MIN_CROP, bounds.height - crop.y), bounds.height - crop.y),
    ),
  };
}

/**
 * WordPress's "Edit Image": rotate, flip, crop and scale, previewed on a
 * canvas exactly as the API will apply them - flip, then rotate clockwise,
 * then crop, then scale down. Saving rewrites the file in place; the original
 * is kept, so "Restore original image" can always undo it.
 */
export function ImageEditor({
  item,
  onCancel,
  onSaved,
}: {
  item: MediaItem | MediaDetail;
  onCancel: () => void;
  onSaved: (detail: MediaDetail) => void;
}) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; x: number; y: number; crop: Crop } | null>(
    null,
  );
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [edit, setEdit] = useState<ImageEdit>(NO_EDIT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const width = item.width ?? image?.naturalWidth ?? 0;
  const height = item.height ?? image?.naturalHeight ?? 0;
  const turned = turnedSize(width, height, edit.rotate);
  const scale =
    turned.width > 0 && turned.height > 0
      ? Math.min(1, PREVIEW_WIDTH / turned.width, PREVIEW_HEIGHT / turned.height)
      : 1;
  const result = editedSize(width, height, edit);
  const cropWidth = edit.crop?.width ?? turned.width;
  const scaling = edit.scale_width !== null && edit.scale_width < cropWidth;
  const changed =
    edit.rotate !== 0 ||
    edit.flip_horizontal ||
    edit.flip_vertical ||
    edit.crop !== null ||
    scaling;

  useEffect(() => {
    if (!item.url) {
      return;
    }

    const loading = new window.Image();
    loading.onload = () => setImage(loading);
    loading.src = item.url;
  }, [item.url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas && image && width > 0 ? canvas.getContext('2d') : null;

    if (!canvas || !context || !image) {
      return;
    }

    canvas.width = Math.round(turned.width * scale);
    canvas.height = Math.round(turned.height * scale);

    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((edit.rotate * Math.PI) / 180);
    // Applied to the picture before the turn, as the API flips before it rotates.
    context.scale(edit.flip_horizontal ? -1 : 1, edit.flip_vertical ? -1 : 1);
    context.drawImage(
      image,
      (-width * scale) / 2,
      (-height * scale) / 2,
      width * scale,
      height * scale,
    );
    context.restore();
  }, [
    image,
    width,
    height,
    scale,
    turned.width,
    turned.height,
    edit.rotate,
    edit.flip_horizontal,
    edit.flip_vertical,
  ]);

  /** Turning or flipping moves the picture under a crop, so the crop starts again. */
  function turn(changes: Partial<Pick<ImageEdit, 'rotate' | 'flip_horizontal' | 'flip_vertical'>>) {
    setEdit((current) => ({ ...current, ...changes, crop: null, scale_width: null }));
  }

  function toggleCrop() {
    setEdit((current) => ({
      ...current,
      scale_width: null,
      crop: current.crop
        ? null
        : {
            x: Math.round(turned.width * 0.1),
            y: Math.round(turned.height * 0.1),
            width: Math.max(1, Math.round(turned.width * 0.8)),
            height: Math.max(1, Math.round(turned.height * 0.8)),
          },
    }));
  }

  function startDrag(event: React.PointerEvent<HTMLElement>, mode: 'move' | 'resize') {
    if (!edit.crop) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { mode, x: event.clientX, y: event.clientY, crop: edit.crop };
  }

  function drag(event: React.PointerEvent<HTMLElement>) {
    const start = dragRef.current;

    if (!start) return;

    const dx = (event.clientX - start.x) / scale;
    const dy = (event.clientY - start.y) / scale;

    setEdit((current) => ({
      ...current,
      crop:
        start.mode === 'move'
          ? moveCrop(start.crop, dx, dy, turned)
          : resizeCrop(start.crop, dx, dy, turned),
    }));
  }

  function endDrag() {
    dragRef.current = null;
  }

  async function send(path: string, body?: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    try {
      const response = await api<{ data: MediaDetail }>(path, { method: 'POST', body });
      onSaved(response.data);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : bn
            ? 'ছবিটি সংরক্ষণ করা যায়নি।'
            : 'The image could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }

  function save() {
    void send(`/admin/media/${item.id}/edit`, {
      rotate: edit.rotate,
      flip_horizontal: edit.flip_horizontal,
      flip_vertical: edit.flip_vertical,
      crop: edit.crop,
      scale_width: scaling ? edit.scale_width : null,
    });
  }

  function restore() {
    const question = bn
      ? 'মূল ছবিটি ফিরিয়ে আনবেন? সব সম্পাদনা মুছে যাবে।'
      : 'Restore the original image? Every edit will be lost.';

    if (window.confirm(question)) {
      void send(`/admin/media/${item.id}/restore`);
    }
  }

  const tool =
    'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line bg-white px-2.5 text-sm text-navy hover:border-blue hover:text-blue disabled:opacity-50';
  const number = 'h-9 w-24 rounded-md border border-line bg-white px-2 text-sm text-navy';

  return (
    <div className="w-full">
      <div
        className="flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label={bn ? 'ছবি সম্পাদনা' : 'Image editing'}
      >
        <button
          type="button"
          className={tool}
          onClick={() => turn({ rotate: ((edit.rotate + 270) % 360) as ImageEdit['rotate'] })}
        >
          ⟲ {bn ? 'বামে ঘোরান' : 'Rotate left'}
        </button>
        <button
          type="button"
          className={tool}
          onClick={() => turn({ rotate: ((edit.rotate + 90) % 360) as ImageEdit['rotate'] })}
        >
          ⟳ {bn ? 'ডানে ঘোরান' : 'Rotate right'}
        </button>
        <button
          type="button"
          className={tool}
          aria-pressed={edit.flip_horizontal}
          onClick={() => turn({ flip_horizontal: !edit.flip_horizontal })}
        >
          ⇋ {bn ? 'আড়াআড়ি উল্টান' : 'Flip horizontally'}
        </button>
        <button
          type="button"
          className={tool}
          aria-pressed={edit.flip_vertical}
          onClick={() => turn({ flip_vertical: !edit.flip_vertical })}
        >
          ⇵ {bn ? 'খাড়াখাড়ি উল্টান' : 'Flip vertically'}
        </button>
        <button
          type="button"
          className={tool}
          aria-pressed={edit.crop !== null}
          onClick={toggleCrop}
        >
          ⌗ {bn ? 'ক্রপ' : 'Crop'}
        </button>
      </div>

      <div className="mt-4 flex justify-center overflow-auto rounded-lg bg-surface p-3">
        <div
          className="relative"
          style={{
            width: Math.round(turned.width * scale),
            height: Math.round(turned.height * scale),
          }}
        >
          <canvas
            ref={canvasRef}
            className="block size-full"
            aria-label={bn ? 'সম্পাদনার প্রিভিউ' : 'Edit preview'}
          />
          {!image ? (
            <span className="absolute inset-0 grid place-items-center text-sm text-muted">
              {bn ? 'ছবি লোড হচ্ছে…' : 'Loading image…'}
            </span>
          ) : null}
          {edit.crop ? (
            <div
              data-testid="crop-area"
              onPointerDown={(event) => startDrag(event, 'move')}
              onPointerMove={drag}
              onPointerUp={endDrag}
              className="absolute cursor-move border-2 border-dashed border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]"
              style={{
                left: edit.crop.x * scale,
                top: edit.crop.y * scale,
                width: edit.crop.width * scale,
                height: edit.crop.height * scale,
              }}
            >
              <span
                aria-hidden="true"
                onPointerDown={(event) => startDrag(event, 'resize')}
                onPointerMove={drag}
                onPointerUp={endDrag}
                className="absolute -end-2 -bottom-2 size-4 cursor-nwse-resize rounded-sm border-2 border-white bg-blue"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4 text-sm">
        {edit.crop ? (
          <>
            <label className="grid gap-1 text-muted">
              {bn ? 'ক্রপের প্রস্থ (px)' : 'Crop width (px)'}
              <input
                type="number"
                min={1}
                max={turned.width - edit.crop.x}
                value={edit.crop.width}
                className={number}
                onChange={(event) =>
                  setEdit((current) =>
                    current.crop
                      ? {
                          ...current,
                          crop: {
                            ...current.crop,
                            width: Math.round(
                              clamp(
                                Number(event.target.value) || 1,
                                1,
                                turned.width - current.crop.x,
                              ),
                            ),
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="grid gap-1 text-muted">
              {bn ? 'ক্রপের উচ্চতা (px)' : 'Crop height (px)'}
              <input
                type="number"
                min={1}
                max={turned.height - edit.crop.y}
                value={edit.crop.height}
                className={number}
                onChange={(event) =>
                  setEdit((current) =>
                    current.crop
                      ? {
                          ...current,
                          crop: {
                            ...current.crop,
                            height: Math.round(
                              clamp(
                                Number(event.target.value) || 1,
                                1,
                                turned.height - current.crop.y,
                              ),
                            ),
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
          </>
        ) : null}
        <label className="grid gap-1 text-muted">
          {bn ? 'ছোট করুন: নতুন প্রস্থ (px)' : 'Scale: new width (px)'}
          <input
            type="number"
            min={1}
            max={cropWidth}
            placeholder={String(cropWidth)}
            value={edit.scale_width ?? ''}
            className={number}
            onChange={(event) =>
              setEdit((current) => ({
                ...current,
                scale_width: event.target.value
                  ? Math.max(1, Math.round(Number(event.target.value)))
                  : null,
              }))
            }
          />
        </label>
        <p className="font-latin text-muted" role="status">
          {bn ? 'ফলাফল' : 'Result'}: {result.width} × {result.height} px
        </p>
      </div>

      {error ? (
        <Callout className="mt-4" tone="danger" role="alert">
          {error}
        </Callout>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={busy || !changed} onClick={save}>
          {bn ? 'সংরক্ষণ' : 'Save edits'}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onCancel}>
          {bn ? 'বাতিল' : 'Cancel'}
        </Button>
        {item.edited ? (
          <button
            type="button"
            disabled={busy}
            onClick={restore}
            className={cn(
              'ms-auto text-sm text-blue underline hover:text-navy disabled:opacity-50',
            )}
          >
            {bn ? 'মূল ছবি ফিরিয়ে আনুন' : 'Restore original image'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
