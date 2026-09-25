import imageLoader, { getOptimizedImageUrl } from "../image-loader";

describe("Next image loader", () => {
  it("uses the default-export ImageLoader contract", () => {
    const result = imageLoader({
      src: "/documents/photo.jpg?version=2#preview",
      width: 640,
      quality: 80,
    });

    expect(result).toBe(
      "/_next/image?url=%2Fdocuments%2Fphoto.jpg%3Fversion%3D2&w=640&q=80#preview",
    );
  });

  it("keeps the named URL helper compatible with the loader", () => {
    expect(getOptimizedImageUrl("/photo.jpg", 320, 70)).toBe(
      imageLoader({ src: "/photo.jpg", width: 320, quality: 70 }),
    );
  });

  it("returns signed URLs unchanged rather than proxying them", () => {
    const signedUrl =
      "https://cdn.example.test/photo.jpg?X-Amz-Signature=abc&X-Amz-Expires=60";

    expect(imageLoader({ src: signedUrl, width: 640 })).toBe(signedUrl);
  });

  it("leaves inline and object URLs unchanged", () => {
    expect(imageLoader({ src: "data:image/png;base64,abc", width: 640 })).toBe(
      "data:image/png;base64,abc",
    );
    expect(imageLoader({ src: "blob:https://example.test/image", width: 640 })).toBe(
      "blob:https://example.test/image",
    );
  });

  it("rejects protocol-relative URLs", () => {
    expect(() => imageLoader({ src: "//cdn.example.test/photo.jpg", width: 640 })).toThrow(
      "Protocol-relative image URLs are not supported",
    );
  });
});
