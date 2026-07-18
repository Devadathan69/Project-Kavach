import "server-only";
import { createHash, randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { env } from "@/lib/env";

export type AcceptedMimeType = "image/jpeg" | "image/png" | "image/webp";

export type ImageTile = {
  tileId: string;
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  dataUrl: string;
};

export type StoredImage = {
  auditId: string;
  relativePath: string;
  sha256: string;
  mimeType: AcceptedMimeType;
  widthPx: number;
  heightPx: number;
  tiles: ImageTile[];
};

const mimeExtensions: Record<AcceptedMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const signatures: Record<AcceptedMimeType, (bytes: Buffer) => boolean> = {
  "image/jpeg": (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (bytes) => bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
};

export function validateImageBytes(bytes: Buffer, mimeType: string): asserts mimeType is AcceptedMimeType {
  if (!(mimeType in signatures)) {
    throw new ImageValidationError("UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG, and WebP images are accepted.");
  }
  const acceptedMime = mimeType as AcceptedMimeType;
  if (!signatures[acceptedMime](bytes)) {
    throw new ImageValidationError("INVALID_IMAGE_SIGNATURE", "The image bytes do not match the declared image type.");
  }
}

export class ImageValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

function absoluteStorageDirectory() {
  return path.resolve(process.cwd(), env.storageDirectory);
}

function makeDataUrl(mimeType: string, bytes: Buffer) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export async function storeAndTileImage(bytes: Buffer, mimeType: AcceptedMimeType): Promise<StoredImage> {
  if (bytes.length > env.maxUploadBytes) {
    throw new ImageValidationError("PAYLOAD_TOO_LARGE", `The image exceeds the ${(env.maxUploadBytes / 1024 / 1024).toFixed(0)} MB upload limit.`);
  }

  let normalizedImage: Buffer;
  let metadata: sharp.Metadata;
  try {
    normalizedImage = await sharp(bytes, { failOnError: true, limitInputPixels: 40_000_000 }).rotate().toBuffer();
    metadata = await sharp(normalizedImage, { failOnError: true }).metadata();
  } catch {
    throw new ImageValidationError("INVALID_IMAGE", "KAVACH could not read this image safely.");
  }

  const widthPx = metadata.width;
  const heightPx = metadata.height;
  if (!widthPx || !heightPx || widthPx < 256 || heightPx < 256) {
    throw new ImageValidationError("INVALID_DIMENSIONS", "The image must be at least 256 × 256 pixels for reliable visual screening.");
  }

  const auditId = randomUUID();
  const sha256 = createHash("sha256").update(normalizedImage).digest("hex");
  const extension = mimeExtensions[mimeType];
  const fileName = `${sha256}.${extension}`;
  const relativePath = path.posix.join(auditId, fileName);
  const directory = path.join(absoluteStorageDirectory(), auditId);

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), normalizedImage, { flag: "wx" });

  const tiles = await createTileManifest(normalizedImage, widthPx, heightPx);
  return { auditId, relativePath, sha256, mimeType, widthPx, heightPx, tiles };
}

async function createTileManifest(source: Buffer, sourceWidth: number, sourceHeight: number): Promise<ImageTile[]> {
  const maximumTileSize = 2048;
  const overlapPx = 128;
  const step = maximumTileSize - overlapPx;
  const positions: Array<{ xPx: number; yPx: number; widthPx: number; heightPx: number }> = [];

  for (let yPx = 0; yPx < sourceHeight; yPx += step) {
    for (let xPx = 0; xPx < sourceWidth; xPx += step) {
      positions.push({
        xPx,
        yPx,
        widthPx: Math.min(maximumTileSize, sourceWidth - xPx),
        heightPx: Math.min(maximumTileSize, sourceHeight - yPx)
      });
    }
  }

  if (positions.length > 36) {
    throw new ImageValidationError("TOO_MANY_TILES", "The image would require more than 36 high-detail analysis tiles. Submit a smaller crop.");
  }

  return Promise.all(positions.map(async (position, index) => {
    const tile = await sharp(source)
      .extract({ left: position.xPx, top: position.yPx, width: position.widthPx, height: position.heightPx })
      .webp({ quality: 92 })
      .toBuffer();

    return {
      tileId: `tile-${index + 1}`,
      ...position,
      dataUrl: makeDataUrl("image/webp", tile)
    };
  }));
}
