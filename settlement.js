/**
 * Backward-compatible entry point.
 * The settlement implementation now lives in the domain layer.
 */
export { computeSettlement, validateSettlement } from './src/domain/settlement.js';
