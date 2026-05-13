"use client";

import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";

interface Props {
  src: string;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}

export default function AvatarCropModal({ src, onCancel, onSave }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, area: Area) => {
    setPixels(area);
  }, []);

  async function handleSave() {
    if (!pixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(src, pixels);
      onSave(blob);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-card2 border border-dark-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-dark-border">
          <h3 className="text-sm font-medium text-white">Adjust avatar</h3>
        </div>
        <div className="relative h-72 bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="px-5 py-3 border-t border-dark-border">
          <label className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">
            Zoom
          </label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
        <div className="px-5 py-3 border-t border-dark-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-dark-card transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !pixels}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function getCroppedBlob(src: string, area: Area): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  const size = Math.min(area.width, area.height, 512);
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
      0.92,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
