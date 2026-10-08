import { z } from 'zod';

const nonEmptyTextSchema = z.string().trim().min(1);

export const locationSchema = z.object({
    city: nonEmptyTextSchema.nullable(),
    region: nonEmptyTextSchema.nullable(),
    country: z
        .string()
        .regex(/^[A-Z]{2}$/)
        .nullable(),
});

export const compensationSchema = z.object({
    amount: z.number().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    period: z.enum(['annual', 'hourly']),
    annualizedUsd: z.number().positive(),
});

export const jobSchema = z.object({
    id: nonEmptyTextSchema,
    title: nonEmptyTextSchema,
    company: nonEmptyTextSchema.nullable(),
    description: nonEmptyTextSchema.nullable(),
    location: locationSchema.nullable(),
    remote: z.boolean(),
    compensation: compensationSchema,
    postingDate: z.iso.date().nullable(),
});

export const jobListResponseSchema = z
    .object({
        items: z.array(jobSchema),
        total: z.number().int().nonnegative(),
        availableCountries: z
            .array(z.string().regex(/^[A-Z]{2}$/))
            .refine(
                (countries) =>
                    countries.every(
                        (country, index) => index === 0 || countries[index - 1]! < country,
                    ),
                'Countries must be unique and sorted',
            ),
    })
    .refine((response) => response.total === response.items.length, {
        message: 'Total must match the number of jobs in this unpaginated response',
        path: ['total'],
    });

export type Job = z.infer<typeof jobSchema>;
export type JobListResponse = z.infer<typeof jobListResponseSchema>;

export const jobQuerySchema = z
    .object({
        search: z.string().trim().max(200).default(''),
        country: z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z]{2}$/)
            .optional(),
        sortBy: z.enum(['salary', 'date']).default('date'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
    })
    .strict();

export type JobQuery = z.infer<typeof jobQuerySchema>;
