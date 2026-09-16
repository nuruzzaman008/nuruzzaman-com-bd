'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/locale-provider';

/*
  Click a picture in an article and see it as large as the screen allows, then
  click again for its actual size - what a reader expects of a drawing or a
  plan, where the detail is the point.

  The pictures are inside HTML the API rendered from Markdown, so there is no
  React element to hang a handler on. One listener on the document handles
  every one of them instead, which also covers pictures that appear later -
  the editor's live preview, for one.
*/

type Picture = { src: string; alt: string };

/*
  A page can render several articles at once - a lesson with its assessments -
  and each one renders this. Only the first listens, so one click opens one
  picture.
*/
let mounted = 0;

/** The picture a click landed on, if it is one a reader may enlarge. */
function pictureFrom(target: EventTarget | null): Picture | null {
  const image = target instanceof Element ? target.closest('img') : null;

  // A picture that is itself a link belongs to the link, not to us.
  if (!image || !image.closest('.prose-nb') || image.closest('a')) {
    return null;
  }

  const src = image.currentSrc || image.src;

  return src ? { src, alt: image.alt } : null;
}

export function ImageLightbox() {
  const { t } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const [picture, setPicture] = useState<Picture | null>(null);
  const [actualSize, setActualSize] = useState(false);

  const close = useCallback(() => {
    setPicture(null);
    setActualSize(false);
  }, []);

  useEffect(() => {
    // Someone else is already listening for the whole page.
    if (mounted > 0) {
      return;
    }

    mounted += 1;

    // Says the cursor is a magnifier only while this is here to answer it.
    document.documentElement.dataset.nbZoom = 'on';

    /*
      Keyboard users reach a picture by tabbing to it, which a plain <img> does
      not allow; the pictures the page was rendered with are given a stop here.
    */
    for (const image of document.querySelectorAll<HTMLImageElement>('.prose-nb img')) {
      if (!image.closest('a')) {
        image.tabIndex = 0;
      }
    }

    function onClick(event: MouseEvent) {
      // Leave every deliberate variation alone: a middle click, a new tab, a
      // drag-select.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const found = pictureFrom(event.target);

      if (found) {
        event.preventDefault();
        setPicture(found);
        setActualSize(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      const found = pictureFrom(document.activeElement);

      if (found) {
        event.preventDefault();
        setPicture(found);
        setActualSize(false);
      }
    }

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      mounted -= 1;
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
      delete document.documentElement.dataset.nbZoom;
    };
  }, []);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    if (picture && !node.open) {
      node.showModal();
    } else if (!picture && node.open) {
      node.close();
    }
  }, [picture]);

  /*
    Every article renders one of these; the ones that are not listening simply
    never open, which costs an empty, closed element and no behaviour.
  */
  return (
    <dialog
      ref={ref}
      aria-label={picture?.alt || t.ui.zoomImage}
      onClose={close}
      onCancel={close}
      // Anywhere outside the picture closes it, as the backdrop does elsewhere.
      onClick={(event) => {
        if (event.target === ref.current) {
          close();
        }
      }}
      className="m-auto max-h-[100dvh] max-w-[100vw] overflow-auto bg-transparent p-0 backdrop:bg-navy/80"
    >
      {picture ? (
        <figure className="m-0 flex flex-col items-center gap-3 p-4">
          <button
            type="button"
            onClick={() => setActualSize((current) => !current)}
            aria-label={actualSize ? t.ui.fitToScreen : t.ui.actualSize}
            className="block cursor-zoom-in rounded-[--radius-card] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            {/* Content pictures are plain <img> in HTML the API rendered; there
                is no known size for next/image to work from. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={picture.src}
              alt={picture.alt}
              className={cn(
                'rounded-[--radius-card] bg-white',
                actualSize ? 'max-w-none' : 'max-h-[82dvh] max-w-[92vw] object-contain',
              )}
            />
          </button>
          {picture.alt ? (
            <figcaption className="max-w-[92vw] text-center text-sm text-white">
              {picture.alt}
            </figcaption>
          ) : null}
          <button
            type="button"
            onClick={close}
            className="min-h-10 rounded-md border border-white/40 px-4 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t.ui.close}
          </button>
        </figure>
      ) : null}
    </dialog>
  );
}
