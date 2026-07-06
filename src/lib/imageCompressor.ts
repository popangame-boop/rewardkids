import imageCompression from "browser-image-compression";

/**
 * Compresses an image file and converts it to WebP format.
 * Supports all standard formats as well as HEIC/HEIF (converts them first).
 * @param file The original image File.
 * @param quality Compression quality from 0 to 1 (default: 0.8).
 * @param maxWidth Max width in pixels (default: 1200).
 * @param maxHeight Max height in pixels (default: 1200).
 */
export async function compressToWebP(
  file: File,
  quality = 0.8,
  maxWidth = 1200,
  maxHeight = 1200
): Promise<File> {
  let fileToProcess = file;

  // Check if file is HEIC or HEIF
  const extension = file.name.split(".").pop()?.toLowerCase();
  const isHeic =
    extension === "heic" ||
    extension === "heif" ||
    file.type === "image/heic" ||
    file.type === "image/heif";

  if (isHeic) {
    try {
      const heic2anyModule = await import("heic2any");
      // heic2any might export directly or as default depending on build environment
      const heic2any = heic2anyModule.default || heic2anyModule;
      
      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });

      const jpegBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
      fileToProcess = new File([jpegBlob], newName, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    } catch (error) {
      console.error("Failed to convert HEIC/HEIF image, falling back to standard loading:", error);
    }
  }

  // Attempt compression with browser-image-compression
  try {
    const options = {
      maxSizeMB: 1, // Target max size
      maxWidthOrHeight: Math.max(maxWidth, maxHeight),
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: quality,
    };

    const compressedBlob = await imageCompression(fileToProcess, options);
    const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
    return new File([compressedBlob], newName, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error("browser-image-compression failed, using canvas fallback:", error);
    
    // Canvas-based fallback
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileToProcess);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Calculate aspect ratio and resize if necessary
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get 2d context from canvas"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Canvas to Blob conversion failed"));
                return;
              }
              const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
              const compressedFile = new File([blob], newName, {
                type: "image/webp",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            "image/webp",
            quality
          );
        };
        img.onerror = () => reject(new Error("Gagal membaca file gambar. Pastikan format file valid."));
      };
      reader.onerror = (err) => reject(err);
    });
  }
}
