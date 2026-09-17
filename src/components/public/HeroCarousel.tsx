"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

interface Banner {
  id: string;
  image_url: string;
  /** Describe la IMAGEN para quien no la ve. No es el titular. */
  alt_text: string;
  link_url: string | null;
  /** Titular visible. Si viene vacío no se dibuja nada encima de la imagen. */
  title: string | null;
  subtitle: string | null;
  cta_label: string | null;
}

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const total = banners.length;
  const isSingle = total <= 1;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev === total - 1 ? 0 : prev + 1));
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? total - 1 : prev - 1));
  }, [total]);

  useEffect(() => {
    if (isSingle || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    timerRef.current = setInterval(nextSlide, 6000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSingle, isPaused, nextSlide]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
  };

  if (total === 0) return null;

  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "1400px",
        margin: "0 auto",
        overflow: "hidden",
        background: "var(--bg-secondary)",
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-label="Carrusel de promociones"
    >
      <div
        style={{
          display: "flex",
          transition: "transform 0.5s ease-in-out",
          transform: `translateX(-${currentIndex * 100}%)`,
        }}
        className="carousel-track"
      >
        {banners.map((banner, index) => {
          const content = (
            <img
              src={
                banner.image_url.startsWith("http")
                  ? banner.image_url
                  : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/company-assets/${banner.image_url}`
              }
              alt={banner.alt_text}
              loading={index === 0 ? "eager" : "lazy"}
              style={{
                width: "100%",
                aspectRatio: "4/1",
                maxHeight: "260px",
                objectFit: "cover",
                display: "block",
              }}
            />
          );

          return (
            <div key={banner.id} style={{ minWidth: "100%", flexShrink: 0 }}>
              {/* Con titular, el banner NO es un enlace entero: lo es sólo el
                  botón. Envolver todo en <a> y meter otro <a> adentro produce
                  enlaces anidados —HTML inválido— y deja a quien navega con
                  teclado sin saber adónde va. Sin titular se conserva el
                  comportamiento de antes: toda la imagen es el enlace. */}
              {banner.title ? (
                <div className="banner-slide">
                  {content}
                  <div className="banner-text">
                    <h2 className="banner-title">{banner.title}</h2>
                    {banner.subtitle && <p className="banner-subtitle">{banner.subtitle}</p>}
                    {banner.cta_label && banner.link_url && (
                      <a href={banner.link_url} className="banner-cta">
                        {banner.cta_label}
                      </a>
                    )}
                  </div>
                </div>
              ) : banner.link_url ? (
                <a href={banner.link_url} style={{ display: "block", width: "100%" }}>
                  {content}
                </a>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>

      {!isSingle && (
        <>
          <button
            onClick={prevSlide}
            aria-label="Anterior banner"
            style={{
              position: "absolute",
              top: "50%",
              left: "1rem",
              transform: "translateY(-50%)",
              background: "rgba(0, 0, 0, 0.65)",
              color: "white",
              border: "none",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 10,
            }}
          >
            <ChevronLeft size={22} />
          </button>

          <button
            onClick={nextSlide}
            aria-label="Siguiente banner"
            style={{
              position: "absolute",
              top: "50%",
              right: "1rem",
              transform: "translateY(-50%)",
              background: "rgba(0, 0, 0, 0.65)",
              color: "white",
              border: "none",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 10,
            }}
          >
            <ChevronRight size={22} />
          </button>

          <div
            style={{
              position: "absolute",
              bottom: "1rem",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              zIndex: 10,
            }}
          >
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Ir al banner ${index + 1}`}
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: currentIndex === index ? "var(--accent)" : "rgba(255, 255, 255, 0.5)",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
            <button
              onClick={() => setIsPaused(!isPaused)}
              aria-label={isPaused ? "Reproducir carrusel" : "Pausar carrusel"}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px",
                marginLeft: "4px",
              }}
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          </div>
        </>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (prefers-reduced-motion: reduce) {
          .carousel-track {
            transition: none !important;
          }
        }
      ` }} />
    </section>
  );
}
