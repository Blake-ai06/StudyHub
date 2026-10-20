import { z } from 'zod'

export const passwordRule = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.')

export const usernameRule = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, 'Use 3–20 letters, numbers, or underscores.')

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name.').max(80),
    username: usernameRule,
    email: z.string().trim().email('Enter a valid email address.'),
    password: passwordRule,
    confirm: z.string(),
    terms: z.boolean().refine((v) => v, 'Accept the Terms and Privacy Policy to continue.'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })

export const resetSchema = z
  .object({ password: passwordRule, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name.').max(80),
  username: usernameRule,
  bio: z.string().trim().max(300, 'Keep your bio under 300 characters.').optional(),
})

export const postSchema = z.object({
  body: z.string().trim().min(1, 'Write something to post.').max(2000, 'Posts can be up to 2000 characters.'),
  visibility: z.enum(['public', 'connections']),
})
export const commentSchema = z.object({ body: z.string().trim().min(1, 'Write a comment.').max(1000, 'Comments can be up to 1000 characters.') })
