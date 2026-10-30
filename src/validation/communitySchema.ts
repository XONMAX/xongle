import { z } from 'zod';
import { communityCreationSchema } from './schemas';

export { communityCreationSchema };
export type CommunityCreationInput = z.input<typeof communityCreationSchema>;
export type CommunityCreationOutput = z.output<typeof communityCreationSchema>;

