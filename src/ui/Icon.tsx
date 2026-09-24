import { icon } from "../art/icons";
import { dataUrl, type Sprite } from "../art/pixel";

/** Crisp pixel icon for the DOM (rendered once to a 4× data URL, scaled with image-rendering: pixelated). */
export function Icon({ id, size = 20, className = "", title }: { id: string; size?: number; className?: string; title?: string }) {
  return <img className={`px-icon ${className}`} src={dataUrl(`icon:${id}`, icon(id), 4)} width={size} height={size} alt={title ?? ""} title={title} draggable={false} />;
}

/** A world sprite (building/station) as a DOM image, height-fitted. */
export function SpriteImg({ sprite, name, height = 48 }: { sprite: Sprite; name: string; height?: number }) {
  const w = Math.round((sprite.width / sprite.height) * height);
  return <img className="px-icon" src={dataUrl(`sprite:${name}`, sprite, 4)} width={w} height={height} alt="" draggable={false} />;
}
