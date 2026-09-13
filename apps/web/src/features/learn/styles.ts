/*
  Class names shared by the course player's server and client components. In a
  module of their own: a string imported from a 'use client' file into a
  server component arrives as a client reference, not as the string.
*/

/** The full-width buttons under the course list: exam, certificate, review. */
export const COURSE_ACTION =
  'flex min-h-12 w-full items-center justify-center rounded-full px-5 text-center text-base font-semibold ' +
  'transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue';

export const COURSE_ACTION_ON = 'bg-blue text-white hover:bg-navy';

export const COURSE_ACTION_OFF = 'cursor-not-allowed bg-line text-muted';
