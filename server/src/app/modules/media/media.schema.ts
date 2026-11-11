import { z } from 'zod';

export const deleteMediaSchema = z
  .object({
    urls: z.array(
      z
        .string({ message: 'Media url must be a string' })
        .min(1, 'Media url is required')
    ),
  })
  .strict();

export type TDeleteMedia = z.infer<typeof deleteMediaSchema>;
