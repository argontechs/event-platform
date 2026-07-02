"use client";

import { useRef } from "react";

/**
 * Card image that opens a full-size lightbox on click. Uses the native
 * <dialog> element: Esc + backdrop dismissal come free, and the image is
 * already cached from the card render (same URL).
 */
export function ZoomableImage({
  src,
  alt,
  className,
  buttonClassName = "block w-full cursor-zoom-in",
}: {
  src: string;
  alt: string;
  className?: string;
  buttonClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={buttonClassName}
        aria-label={`View ${alt} full size`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </button>
      <dialog
        ref={ref}
        onClick={() => ref.current?.close()}
        className="m-auto bg-transparent p-0 backdrop:bg-black/85"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-[90vh] max-w-[92vw] cursor-zoom-out rounded-lg" />
      </dialog>
    </>
  );
}
