/**
 * Typed client for the nuruzzaman.com.bd API.
 *
 * Types are generated from openapi.yaml (`npm run contracts:types`) so the
 * frontend and the backend cannot disagree about a field name or a status.
 *
 * Authentication is a first-party Sanctum cookie session. Nothing here reads or
 * writes a token, and nothing touches localStorage.
 */
export type { paths, components, operations } from './generated/api';
export * from './client';
export * from './money';
