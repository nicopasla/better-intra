import qrcodeGenerator from "qrcode-generator";

export function generateQrDataUrl(text: string, size = 200): string {
  const qr = qrcodeGenerator(0, "M");
  qr.addData(text);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const cellSize = Math.floor(size / moduleCount);
  const margin = Math.floor((size - cellSize * moduleCount) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#000000";
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(
          margin + col * cellSize,
          margin + row * cellSize,
          cellSize,
          cellSize,
        );
      }
    }
  }

  return canvas.toDataURL("image/png");
}
