import { afterEach, describe, expect, it, vi } from "vitest";

import { compressFormFiles, compressImage, MAX_UPLOAD_BYTES } from "./compress-image";

const MB = 1024 * 1024;
const fileOf = (name: string, type: string, size: number) => new File([new Uint8Array(size)], name, { type });

afterEach(() => vi.restoreAllMocks());

// jsdom has no image decoder or canvas encoder: fake a 4000x3000 photo whose JPEG is 3 MB at quality
// 0.85 and 1 MB at 0.7, so the first attempt is too big and the second fits.
function fakeCanvas() {
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 4000, height: 3000, close }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, _type, quality) => {
    callback(new Blob([new Uint8Array((quality ?? 1) > 0.8 ? 3 * MB : MB)], { type: "image/jpeg" }));
  });
  return { close };
}

describe("compressImage", () => {
  it("leaves files at or under 2 MB and non-images untouched", async () => {
    const small = fileOf("a.png", "image/png", MAX_UPLOAD_BYTES);
    const pdf = fileOf("a.pdf", "application/pdf", 5 * MB);
    expect(await compressImage(small)).toBe(small);
    expect(await compressImage(pdf)).toBe(pdf);
  });

  it("re-encodes a large photo as a JPEG under 2 MB", async () => {
    const { close } = fakeCanvas();
    const result = await compressImage(fileOf("car.photo.png", "image/png", 6 * MB));
    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("car.photo.jpg");
    expect(result.size).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
    expect(close).toHaveBeenCalled();
  });

  it("returns the original when the image cannot be decoded", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("bad image")));
    const broken = fileOf("x.jpg", "image/jpeg", 3 * MB);
    expect(await compressImage(broken)).toBe(broken);
  });
});

describe("compressFormFiles", () => {
  it("keeps text fields and repeated keys, shrinking each file", async () => {
    fakeCanvas();
    const fd = new FormData();
    fd.set("job_id", "7");
    fd.append("receipts", fileOf("a.jpg", "image/jpeg", 100));
    fd.append("receipts", fileOf("b.jpg", "image/jpeg", 4 * MB));
    const result = await compressFormFiles(fd);
    expect(result.get("job_id")).toBe("7");
    const receipts = result.getAll("receipts") as File[];
    expect(receipts.map((file) => file.name)).toEqual(["a.jpg", "b.jpg"]);
    expect(receipts.every((file) => file.size <= MAX_UPLOAD_BYTES)).toBe(true);
  });
});
