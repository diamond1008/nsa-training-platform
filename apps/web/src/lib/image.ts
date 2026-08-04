/**
 * Compress and convert an uploaded image file into a WebP base64 data URL.
 * Resizes the image to fit within maxWidth/maxHeight while preserving aspect ratio.
 */
export function compressImageToWebP(
  file: File,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return reject(new Error("File tải lên phải là định dạng hình ảnh."));
    }
    if (file.size > 10 * 1024 * 1024) {
      return reject(new Error("Ảnh gốc không được vượt quá 10 MB."));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          return reject(new Error("Không thể xử lý ảnh bằng Canvas."));
        }

        ctx.drawImage(img, 0, 0, width, height);
        const webpDataUrl = canvas.toDataURL("image/webp", quality);
        const estimatedBytes = Math.ceil(
          (webpDataUrl.length - webpDataUrl.indexOf(",") - 1) * 0.75,
        );
        if (estimatedBytes > 256 * 1024) {
          return reject(new Error("Ảnh sau khi nén vẫn vượt quá 256 KiB. Vui lòng chọn ảnh khác."));
        }
        resolve(webpDataUrl);
      };
      img.onerror = () => reject(new Error("Không thể đọc định dạng hình ảnh."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Không thể đọc tệp hình ảnh."));
    reader.readAsDataURL(file);
  });
}
