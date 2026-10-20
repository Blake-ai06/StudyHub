import { z } from 'zod'

// Zod normally tries `new Function(...)` to speed up validation. Our Content-Security-Policy (correctly) forbids eval,
// so every attempt is blocked and reported. "jitless" makes Zod skip the attempt. Validation behaves identically.
// This file must be imported before any schema is created (see main.tsx).
z.config({ jitless: true })
