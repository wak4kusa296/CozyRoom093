import Image from "next/image";
import type { CSSProperties, ImgHTMLAttributes } from "react";

type CommonProps = {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  decoding?: ImgHTMLAttributes<HTMLImageElement>["decoding"];
  style?: CSSProperties;
  objectFit?: CSSProperties["objectFit"];
};

type AppImageProps =
  | (CommonProps & {
      fill: true;
      width?: never;
      height?: never;
    })
  | (CommonProps & {
      fill?: false;
      width: number;
      height: number;
    });

function getConfiguredOrigins(): string[] {
  return [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_APP_URL]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => {
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });
}

function toLocalImageSource(source: string): string | null {
  if (source.startsWith("/") && !source.startsWith("//")) {
    return source;
  }

  try {
    const url = new URL(source);
    if ((url.protocol === "http:" || url.protocol === "https:") && getConfiguredOrigins().includes(url.origin)) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    // Non-URL sources are not valid image URLs.
  }

  return null;
}

function isDirectImageSource(source: string): boolean {
  if (/^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(source)) return true;

  try {
    const url = new URL(source);
    if (url.protocol === "blob:") return Boolean(url.pathname);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Uses Next's optimizer for local images and intentionally preserves direct
 * browser loading for dynamic external, blob, and data image URLs.
 */
export function AppImage(props: AppImageProps) {
  const { src, alt, className, sizes, priority, loading, decoding, style, objectFit, fill } = props;
  const source = src?.trim();
  if (!source) return null;

  const localSource = toLocalImageSource(source);
  const imageStyle = objectFit ? { ...style, objectFit } : style;

  if (localSource) {
    if (fill) {
      return (
        <Image
          src={localSource}
          alt={alt}
          className={className}
          sizes={sizes}
          priority={priority}
          loading={loading}
          decoding={decoding}
          style={imageStyle}
          fill
        />
      );
    }

    return (
      <Image
        src={localSource}
        alt={alt}
        className={className}
        width={props.width}
        height={props.height}
        sizes={sizes}
        priority={priority}
        loading={loading}
        decoding={decoding}
        style={imageStyle}
      />
    );
  }

  if (!isDirectImageSource(source)) return null;

  // eslint-disable-next-line @next/next/no-img-element -- external/blob/data images cannot use Next's optimizer.
  return <img src={source} alt={alt} className={className} sizes={sizes} loading={loading} decoding={decoding} style={imageStyle} />;
}
