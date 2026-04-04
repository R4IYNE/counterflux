/**
 * Toast notification component.
 *
 * Toast rendering is handled inline in index.html via Alpine directives.
 * This module provides the icon and colour mappings for toast types.
 */

/**
 * Toast type configuration -- icon and colour for each type.
 */
export const TOAST_TYPES = {
  info: {
    icon: 'info',
    bgClass: 'bg-primary/20',
    borderClass: 'border-primary/40',
    textClass: 'text-primary',
  },
  success: {
    icon: 'check_circle',
    bgClass: 'bg-success/20',
    borderClass: 'border-success/40',
    textClass: 'text-success',
  },
  warning: {
    icon: 'warning',
    bgClass: 'bg-warning/20',
    borderClass: 'border-warning/40',
    textClass: 'text-warning',
  },
  error: {
    icon: 'error',
    bgClass: 'bg-secondary/20',
    borderClass: 'border-secondary/40',
    textClass: 'text-secondary',
  },
};

/**
 * Returns the CSS classes for a toast based on its type.
 * @param {string} type - Toast type (info, success, warning, error)
 * @returns {Object} Toast type config
 */
export function getToastConfig(type) {
  return TOAST_TYPES[type] || TOAST_TYPES.info;
}
