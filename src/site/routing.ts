import config from './config';

export const routing = config[process.env.NEXT_PUBLIC_SITE_ROUTING_CONFIG || 'default'];
