import { getStore } from '@netlify/blobs';
export const contentStore = () => getStore({name:'hovai-content', consistency:'strong'});
export const mediaStore = () => getStore({name:'hovai-media', consistency:'strong'});
