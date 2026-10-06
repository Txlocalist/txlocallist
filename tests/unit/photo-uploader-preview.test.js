import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhotoUploader } from "@/components/PhotoUploader/PhotoUploader";

describe("saved photo previews", () => {
  it("renders an existing external photo URL without requiring a Next optimizer hostname", () => {
    const url = "https://www.roundrockfirefighters.org/round-rock-safety";
    const html = renderToStaticMarkup(createElement(PhotoUploader, {
      photos: [{ url, name: "Existing event cover" }], onChange: () => {}, maxPhotos: 1,
    }));
    expect(html).toContain(`src="${url}"`);
    expect(html).not.toContain("/_next/image");
    expect(html).toContain('aria-label="Remove photo"');
  });
  it("continues to use the private Blob proxy for uploaded photos", () => {
    const html = renderToStaticMarkup(createElement(PhotoUploader, {
      photos: [{ url: "https://test.private.blob.vercel-storage.com/cover.webp" }], onChange: () => {},
    }));
    expect(html).toContain("/api/blob-image?url=");
  });
});
