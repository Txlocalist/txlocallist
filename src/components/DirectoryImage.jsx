import Image from "next/image";
import { getBlobImageUrl } from "@/lib/blob";

// Uploaded photos use the existing image proxy, which Next can resize/cache.
// Preserve support for other user-supplied URLs without allowing arbitrary
// hosts through the server's image optimizer.
export default function DirectoryImage({ src, alt = "", sizes = "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw", ...props }) {
  const imageSrc = getBlobImageUrl(src);
  const optimizable = imageSrc?.startsWith("/api/blob-image?") ||
    /^https:\/\/(lh3\.googleusercontent\.com|picsum\.photos)\//.test(imageSrc || "");

  return (
    <Image
      {...props}
      src={imageSrc}
      alt={alt}
      width={640}
      height={400}
      sizes={sizes}
      unoptimized={!optimizable}
      loading="lazy"
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}
