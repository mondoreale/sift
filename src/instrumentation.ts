export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { getRepository } = await import('./server/runtime');
        try {
            await getRepository();
        } catch (error) {
            console.error('Job ingestion failed.', error);
            process.exit(1);
        }
    }
}
