"use client";

import { useState, useRef, useEffect, useCallback } from "react";

import { getBlobImageUrl } from "@/lib/blob";

import styles from "./PhotoGallery.module.css";

export default function PhotoGallery({ photos, businessName }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef(null);

  // Update arrow visibility based on scroll position
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  function scrollGallery(dir) {
    scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  function openLightbox(i) {
    setLightboxIndex(i);
  }

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const prevPhoto = useCallback((event) => {
    event?.stopPropagation();
    setLightboxIndex((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const nextPhoto = useCallback((event) => {
    event?.stopPropagation();
    setLightboxIndex((i) => (i + 1) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (lightboxIndex === null) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxIndex]);

  // Keyboard nav in lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e) {
      if (e.key === "ArrowLeft")  prevPhoto();
      if (e.key === "ArrowRight") nextPhoto();
      if (e.key === "Escape")     closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeLightbox, lightboxIndex, nextPhoto, prevPhoto]);

  return (
    <>
      {/* ── Gallery strip ── */}
      <div className={styles.galleryWrap}>

        {/* Left arrow */}
        <button
          className={`${styles.scrollArrow} ${styles.scrollArrowLeft} ${!canScrollLeft ? styles.scrollArrowHidden : ""}`}
          onClick={() => scrollGallery(-1)}
          aria-label="Scroll left"
        >
          <span className="material-icons">chevron_left</span>
        </button>

        <div ref={scrollRef} className={styles.galleryScroll}>
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              className={styles.galleryItem}
              onClick={() => openLightbox(i)}
              aria-label={`View photo ${i + 1}`}
            >
              <img
                src={getBlobImageUrl(photo.url)}
                alt={photo.alt || businessName}
                className={styles.galleryImg}
              />
            </button>
          ))}
        </div>

        {/* Right arrow */}
        <button
          className={`${styles.scrollArrow} ${styles.scrollArrowRight} ${!canScrollRight ? styles.scrollArrowHidden : ""}`}
          onClick={() => scrollGallery(1)}
          aria-label="Scroll right"
        >
          <span className="material-icons">chevron_right</span>
        </button>
      </div>

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && (
        <div className={styles.lightboxOverlay} onClick={closeLightbox}>
          <div
            className={styles.lightboxInner}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button className={styles.lightboxClose} onClick={closeLightbox} aria-label="Close">
              <span className="material-icons">close</span>
            </button>

            {/* Prev */}
            {photos.length > 1 && (
              <button className={`${styles.lightboxNav} ${styles.lightboxPrev}`} onClick={prevPhoto} aria-label="Previous">
                <span className="material-icons">chevron_left</span>
              </button>
            )}

            {/* Photo */}
            <img
              src={getBlobImageUrl(photos[lightboxIndex].url)}
              alt={photos[lightboxIndex].alt || businessName}
              className={styles.lightboxImg}
            />

            {/* Next */}
            {photos.length > 1 && (
              <button className={`${styles.lightboxNav} ${styles.lightboxNext}`} onClick={nextPhoto} aria-label="Next">
                <span className="material-icons">chevron_right</span>
              </button>
            )}

            {/* Counter */}
            <div className={styles.lightboxCounter}>
              {lightboxIndex + 1} / {photos.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
