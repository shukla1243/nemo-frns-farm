/** Shared shapes for live presence. Kept apart from presence.ts so the HUD and world never pull WebRTC into the main chunk. */
export type Peer = { id: string; friendId: string; name: string; level: number; title: string; x: number; y: number; facing: string; emote: string; emoteAt: number; seen: number };

export const EMOTES = ["heart", "star", "fire", "trophy", "skull", "clownfish", "sword", "moodHappy"] as const;
