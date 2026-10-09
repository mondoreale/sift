import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    outputFileTracingIncludes: {
        '/*': ['./fixtures/*.json'],
    },
};

export default nextConfig;
