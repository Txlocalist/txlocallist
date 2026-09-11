/* eslint-disable @next/next/no-img-element -- Browser fixture for Next Image. */
export default function Image({ src, alt = "", priority, fill, unoptimized, ...props }) { return <img src={src?.src || src} alt={alt} {...props} />; }
