const BASE = '/api';

async function request(url, options = {}) {
    const res = await fetch(`${BASE}${url}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Request failed');
    }
    if (res.status === 204) return null;
    return res.json();
}

export const api = {
    // Companies
    getCompanies: () => request('/companies'),
    getCompany: (id) => request(`/companies/${id}`),
    createCompany: (data) => request('/companies', { method: 'POST', body: JSON.stringify(data) }),
    updateCompany: (id, data) => request(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCompany: (id) => request(`/companies/${id}`, { method: 'DELETE' }),
    uploadCertificate: (id, file) => { // Deprecated, but kept for compatibility
        const fd = new FormData();
        fd.append('certificate', file);
        return fetch(`${BASE}/companies/${id}/upload`, { method: 'POST', body: fd }).then(r => r.json());
    },
    getCompanyDocuments: (id) => request(`/companies/${id}/documents`),
    uploadCompanyDocument: (id, file) => {
        const fd = new FormData();
        fd.append('file', file);
        // Use fetch directly for FormData + file upload
        return fetch(`${BASE}/companies/${id}/documents`, { method: 'POST', body: fd })
            .then(async res => {
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: res.statusText }));
                    throw new Error(err.error || 'Upload failed');
                }
                return res.json();
            });
    },
    deleteCompanyDocument: (id, docId) => request(`/companies/${id}/documents/${docId}`, { method: 'DELETE' }),

    // Clients
    getClients: () => request('/clients'),
    getClient: (id) => request(`/clients/${id}`),
    createClient: (data) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
    updateClient: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),

    // Entries
    getEntries: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/entries${qs ? '?' + qs : ''}`);
    },
    createEntry: (data) => request('/entries', { method: 'POST', body: JSON.stringify(data) }),
    updateEntry: (id, data) => request(`/entries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEntry: (id) => request(`/entries/${id}`, { method: 'DELETE' }),

    // Invoices
    getInvoices: () => request('/invoices'),
    getInvoice: (id) => request(`/invoices/${id}`),
    createInvoice: (data) => request('/invoices', { method: 'POST', body: JSON.stringify(data) }),
    updateInvoice: (id, data) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteInvoice: (id) => request(`/invoices/${id}`, { method: 'DELETE' }),
    markPaid: (id) => request(`/invoices/${id}/paid`, { method: 'PUT' }),
    emailInvoice: (id, pdfBase64) => request(`/invoices/${id}/email`, { method: 'POST', body: JSON.stringify({ pdfBase64 }) }),

    // SMTP
    getSmtp: () => request('/smtp'),
    updateSmtp: (data) => request('/smtp', { method: 'PUT', body: JSON.stringify(data) }),
};
