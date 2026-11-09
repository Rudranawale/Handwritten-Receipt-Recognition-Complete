let pending: File | null = null;
export const setPendingFile = (f: File) => { pending = f; };
export const takePendingFile = () => { const f = pending; pending = null; return f; };
