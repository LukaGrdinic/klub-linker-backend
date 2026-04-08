import { Readable } from "node:stream";
import cloudinary from "../config/cloudinary";

export type UploadResult = { url: string; publicId: string; resourceType: string };

export function uploadBuffer(
  buffer: Buffer,
  options: {
    folder: string;
    resourceType: "image" | "video" | "raw";
  }
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadOpts: Record<string, unknown> = {
      folder: options.folder,
      resource_type: options.resourceType,
      ...(options.resourceType === "image"
        ? {
            transformation: [{ width: 1920, height: 1920, crop: "limit" }, { quality: "auto", fetch_format: "auto" }],
          }
        : {}),
    };
    const stream = cloudinary.uploader.upload_stream(uploadOpts, (err, result) => {
      if (err || !result) {
        reject(err ?? new Error("Cloudinary upload failed"));
        return;
      }
      resolve({
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
      });
    });
    Readable.from(buffer).pipe(stream);
  });
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}
