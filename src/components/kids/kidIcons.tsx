"use client";

import { Apple, Bird, Car, Cat, Dog, Fish, Heart, Star, Sun, type LucideIcon } from "lucide-react";
import { Sticker } from "@/components/studio/coloring/rewards";

/** The nine pictures a child's two-picture password is made of (index = value stored in kid_members.pin). */
export const PIN_PICTURES: { Icon: LucideIcon; color: string; name: string }[] = [
  { Icon: Cat, color: "#8a6a4f", name: "Cat" },
  { Icon: Dog, color: "#b7793e", name: "Dog" },
  { Icon: Fish, color: "#2f80ed", name: "Fish" },
  { Icon: Bird, color: "#3cb371", name: "Bird" },
  { Icon: Apple, color: "#e5484d", name: "Apple" },
  { Icon: Sun, color: "#f08c2e", name: "Sun" },
  { Icon: Star, color: "#e0a13c", name: "Star" },
  { Icon: Heart, color: "#e05a9b", name: "Heart" },
  { Icon: Car, color: "#8e5ad6", name: "Car" },
];

export function PinPicture({ index, size = 40 }: { index: number; size?: number }) {
  const { Icon, color } = PIN_PICTURES[index % PIN_PICTURES.length];
  return (
    <span className="inline-flex items-center justify-center rounded-[14px] bg-white" style={{ width: size, height: size, boxShadow: `inset 0 0 0 2px ${color}33` }} aria-hidden>
      <Icon size={size * 0.6} color={color} strokeWidth={2.2} />
    </span>
  );
}

/** A child's picture: one of the sticker badges, kept upright. */
export function KidAvatar({ index, size = 56 }: { index: number; size?: number }) {
  return (
    <span className="inline-flex" style={{ transform: `rotate(${-(((index * 37) % 24) - 12)}deg)` }}>
      <Sticker index={index} size={size} />
    </span>
  );
}

/** A "well done" certificate for finishing a book, as a PNG to print. */
export function certificateImage(name: string, bookTitle: string, groupName: string, labels: { heading: string; line: string; footer: string }): string {
  const width = 1100;
  const height = 850;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  // Double border, colored corners.
  ctx.strokeStyle = "#e0a13c";
  ctx.lineWidth = 14;
  ctx.strokeRect(30, 30, width - 60, height - 60);
  ctx.strokeStyle = "#3357d4";
  ctx.lineWidth = 4;
  ctx.strokeRect(56, 56, width - 112, height - 112);
  const dots = ["#e5484d", "#f5c518", "#3cb371", "#2f80ed"];
  [[56, 56], [width - 56, 56], [56, height - 56], [width - 56, height - 56]].forEach(([x, y], i) => {
    ctx.fillStyle = dots[i];
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "#14151a";
  ctx.font = "800 64px Arial, Helvetica, sans-serif";
  ctx.fillText(labels.heading, width / 2, 220, width - 200);
  ctx.font = "800 92px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "#3357d4";
  ctx.fillText(name, width / 2, 400, width - 200);
  ctx.font = "500 34px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "#14151a";
  ctx.fillText(labels.line, width / 2, 490, width - 200);
  ctx.font = "700 44px Arial, Helvetica, sans-serif";
  ctx.fillText(`“${bookTitle}”`, width / 2, 560, width - 200);
  ctx.font = "400 26px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "#6b7280";
  ctx.fillText(`${groupName} · ${labels.footer}`, width / 2, 700, width - 200);
  // A big star.
  ctx.fillStyle = "#f5c518";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 46 : 20;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(width / 2 + r * Math.cos(a), 110 + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
  return canvas.toDataURL("image/png");
}
