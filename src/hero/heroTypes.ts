import type { Object3D } from "three";

export type HeroPhase =
  | "identity"
  | "detaching"
  | "inspect"
  | "powering-on"
  | "front-aligned"
  | "experience"
  | "depleted"
  | "power-loss"
  | "returning"
  | "recharging"
  | "resetting";

export type HeroScreenBounds = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export type HeroVector3Tuple = readonly [number, number, number];

export type HeroCableAnchor = Readonly<{
  dock?: Object3D;
  position: HeroVector3Tuple;
  quaternion?: readonly [number, number, number, number];
  scale?: number;
}>;

export type HeroScreenGeometry = Readonly<{
  localBounds: Readonly<{
    min: HeroVector3Tuple;
    max: HeroVector3Tuple;
    width: number;
    height: number;
  }>;
  worldCorners: readonly HeroVector3Tuple[];
  projectedRect: HeroScreenBounds;
  aspectRatio: number;
  frontNormal: HeroVector3Tuple;
}>;

export type HeroState = Readonly<{
  phase: HeroPhase;
  name: string;
  awaitingPower: boolean;
  bootStartedAt: number | null;
  bootComplete: boolean;
  terminalFired: boolean;
  resetGeneration: number;
}>;
