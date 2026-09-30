// The Pagewright UI primitives as one library entry — what the design-system
// build (scripts/build-ds.mjs) packages for Claude Design. The app itself keeps
// importing each component from its own file.
export { default as Button } from "./Button";
export type { ButtonProps, ButtonVariant } from "./Button";
export { default as Card } from "./Card";
export type { CardProps } from "./Card";
export { default as ColorSwatch } from "./ColorSwatch";
export type { ColorSwatchProps } from "./ColorSwatch";
export { default as MetaLabel } from "./MetaLabel";
export type { MetaLabelProps } from "./MetaLabel";
export { default as SegmentedControl } from "./SegmentedControl";
export type { SegmentedControlOption, SegmentedControlProps } from "./SegmentedControl";
export { default as Slider } from "./Slider";
export type { SliderProps } from "./Slider";
export { default as StatusDot } from "./StatusDot";
export type { StatusDotProps, StatusDotTone } from "./StatusDot";
export { default as Thumbnail, PLACEHOLDER_ART_PATTERN } from "./Thumbnail";
export type { ThumbnailProps } from "./Thumbnail";
export { default as Toggle } from "./Toggle";
export type { ToggleProps } from "./Toggle";
