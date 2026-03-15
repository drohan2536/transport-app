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

    // Outstanding
    getOutstanding: (from_date, to_date) => request(`/outstanding?from_date=${from_date}&to_date=${to_date}`),
    getOutstandingDetail: (clientId, from_date, to_date) => request(`/outstanding/client/${clientId}?from_date=${from_date}&to_date=${to_date}`),

    // SMTP
    getSmtp: () => request('/smtp'),
    updateSmtp: (data) => request('/smtp', { method: 'PUT', body: JSON.stringify(data) }),

    // Settings
    getSettings: () => request('/settings'),
    updateSettings: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
    resetInvoiceNumber: (data) => request('/settings/reset-invoice-number', { method: 'POST', body: JSON.stringify(data) }),
    getInvoiceOverrides: () => request('/settings/invoice-overrides'),

    // Backup & Restore
    getBackupInfo: () => request('/settings/backup-info'),
    downloadBackup: () => {
        // Direct download via window.open (no JSON response)
        window.open(`${BASE}/settings/backup`, '_blank');
    },
    restoreBackup: async (file) => {
        const fd = new FormData();
        fd.append('backup', file);
        const res = await fetch(`${BASE}/settings/restore`, { method: 'POST', body: fd });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || 'Restore failed');
        }
        return res.json();
    },

    // Vehicles
    getVehicles: () => request('/vehicles'),

    // Workers
    getWorkers: () => request('/workers'),
    getWorker: (id) => request(`/workers/${id}`),
    createWorker: (data) => request('/workers', { method: 'POST', body: JSON.stringify(data) }),
    updateWorker: (id, data) => request(`/workers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteWorker: (id) => request(`/workers/${id}`, { method: 'DELETE' }),

    // Attendance
    getAttendance: (workerId, from_date, to_date) => {
        const qs = new URLSearchParams({ from_date, to_date }).toString();
        return request(`/workers/${workerId}/attendance?${qs}`);
    },
    markAttendance: (workerId, data) => request(`/workers/${workerId}/attendance`, { method: 'POST', body: JSON.stringify(data) }),
    bulkAttendance: (workerId, records) => request(`/workers/${workerId}/attendance/bulk`, { method: 'POST', body: JSON.stringify({ records }) }),
    deleteAttendance: (attId) => request(`/workers/attendance/${attId}`, { method: 'DELETE' }),

    // Worker Advances
    getAdvances: (workerId, from_date, to_date) => {
        const qs = new URLSearchParams({ from_date, to_date }).toString();
        return request(`/workers/${workerId}/advances?${qs}`);
    },
    createAdvance: (workerId, data) => request(`/workers/${workerId}/advances`, { method: 'POST', body: JSON.stringify(data) }),
    deleteAdvance: (advId) => request(`/workers/advances/${advId}`, { method: 'DELETE' }),

    // Worker Pending
    getPending: (workerId, from_date, to_date) => {
        const qs = new URLSearchParams({ from_date, to_date }).toString();
        return request(`/workers/${workerId}/pending?${qs}`);
    },
    createPending: (workerId, data) => request(`/workers/${workerId}/pending`, { method: 'POST', body: JSON.stringify(data) }),
    deletePending: (penId) => request(`/workers/pending/${penId}`, { method: 'DELETE' }),

    // Salary Calculation
    getWorkerSalary: (workerId, from_date, to_date) => request(`/workers/${workerId}/salary?from_date=${from_date}&to_date=${to_date}`),
    getAllSalaries: (from_date, to_date) => request(`/workers/salary/all?from_date=${from_date}&to_date=${to_date}`),

    // Holidays
    getHolidays: (from_date, to_date) => {
        let url = '/workers/holidays/all';
        if (from_date && to_date) url += `?from_date=${from_date}&to_date=${to_date}`;
        return request(url);
    },
    createHoliday: (data) => request('/workers/holidays', { method: 'POST', body: JSON.stringify(data) }),
    deleteHoliday: (id) => request(`/workers/holidays/${id}`, { method: 'DELETE' }),
};
