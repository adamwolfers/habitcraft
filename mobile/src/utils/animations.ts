/**
 * Animation utilities for React Native Reanimated
 */
import {
  withSpring,
  withTiming,
  WithSpringConfig,
  WithTimingConfig,
} from 'react-native-reanimated';

/**
 * Spring configuration for snappy animations
 */
export const springConfig: WithSpringConfig = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

/**
 * Timing configuration for smooth fades
 */
export const fadeConfig: WithTimingConfig = {
  duration: 200,
};

/**
 * Animate a value with spring physics
 */
export function animateSpring(toValue: number, config = springConfig) {
  return withSpring(toValue, config);
}

/**
 * Animate a value with linear timing
 */
export function animateTiming(toValue: number, config = fadeConfig) {
  return withTiming(toValue, config);
}

/**
 * Scale animation values for press feedback
 */
export const SCALE_PRESSED = 0.95;
export const SCALE_DEFAULT = 1;

/**
 * Opacity animation values for fade effects
 */
export const OPACITY_HIDDEN = 0;
export const OPACITY_VISIBLE = 1;
