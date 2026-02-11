import logoUrl from '../assets/logo.svg';

// Helper to convert image URL to Base64
export const getBase64ImageFromURL = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.setAttribute("crossOrigin", "anonymous");
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL("image/png");
            resolve(dataURL);
        };
        img.onerror = error => reject(error);
        img.src = url;
    });
};

// Helper to get value securely
const getVal = (obj, path, def = '-') => {
    const v = obj[path];
    return (v === null || v === undefined || v === '') ? def : v;
};

export const loadLogoBase64 = async () => {
    try {
        return await getBase64ImageFromURL(logoUrl);
    } catch (e) {
        console.error('Logo load failed', e);
        return null;
    }
};

export function buildPdfDefinition(invoice, logoBase64) {
    const entries = invoice.entries || [];

    // Default columns if none selected
    const defaultCols = ['date', 'from_location', 'to_location', 'entry_type', 'challan_number', 'vehicle_number', 'amount', 'loading_charges', 'total_amount'];
    let visibleColIds = [];
    try {
        visibleColIds = JSON.parse(invoice.invoice_visible_columns || '[]');
    } catch (e) { }

    if (visibleColIds.length === 0) visibleColIds = defaultCols;

    // Column Definitions
    const colDefs = {
        date: { header: 'Date', width: 'auto', val: e => e.date },
        from_location: { header: 'From', width: '*', val: e => e.from_location },
        to_location: { header: 'To', width: '*', val: e => e.to_location },
        challan_number: { header: 'Challan', width: 'auto', val: e => e.has_challan ? e.challan_number : '-' },
        vehicle_number: { header: 'Vehicle', width: 'auto', val: e => e.has_vehicle ? e.vehicle_number : '-' },
        entry_type: { header: 'Type', width: 'auto', val: e => e.entry_type === 'per_kg' ? 'Kg' : 'Bdl' },
        unit: { header: 'Unit', width: 'auto', val: e => e.unit },
        length: { header: 'L', width: 'auto', val: e => e.length },
        width: { header: 'W', width: 'auto', val: e => e.width },
        gsm: { header: 'GSM', width: 'auto', val: e => e.gsm },
        packaging: { header: 'Pkg', width: 'auto', val: e => e.packaging },
        no_of_packets: { header: 'Pkt', width: 'auto', val: e => e.no_of_packets },
        weight: { header: 'Wgt', width: 'auto', align: 'right', val: e => e.weight },
        rate_per_kg: { header: 'Rate/Kg', width: 'auto', align: 'right', val: e => e.rate_per_kg },
        no_of_bundles: { header: 'Bdls', width: 'auto', val: e => e.no_of_bundles },
        rate_per_bundle: { header: 'Rate/Bdl', width: 'auto', align: 'right', val: e => e.rate_per_bundle },
        amount: { header: 'Amt', width: 'auto', align: 'right', val: e => `₹${(e.amount || 0).toFixed(2)}` },
        loading_charges: { header: 'Load', width: 'auto', align: 'right', val: e => e.loading_charges ? `₹${e.loading_charges}` : '-' },
        total_amount: { header: 'Total', width: 'auto', align: 'right', bold: true, val: e => `₹${(e.total_amount || 0).toFixed(2)}` },
    };

    // Always include Index
    const tableHeaders = [{ text: '#', style: 'tableHeader', alignment: 'center' }];
    const tableWidths = [20];

    visibleColIds.forEach(id => {
        const def = colDefs[id];
        if (def) {
            tableHeaders.push({ text: def.header, style: 'tableHeader', alignment: def.align || 'left' });
            tableWidths.push(def.width || 'auto');
        }
    });

    const tableBody = [tableHeaders];

    entries.forEach((e, i) => {
        const row = [{ text: (i + 1).toString(), alignment: 'center' }];
        visibleColIds.forEach(id => {
            const def = colDefs[id];
            if (def) {
                row.push({ text: getVal(e, id, '-') && def.val(e), alignment: def.align || 'left', bold: def.bold || false });
            }
        });
        tableBody.push(row);
    });

    const content = [
        { text: invoice.company_name, style: 'companyName', alignment: 'center' },
        { text: invoice.company_address || '', alignment: 'center', fontSize: 10, color: '#666', margin: [0, 0, 0, 2] },
        { text: invoice.company_phone ? `Phone: ${invoice.company_phone}` : '', alignment: 'center', fontSize: 9, color: '#999', margin: [0, 0, 0, 15] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#ddd' }], margin: [0, 0, 0, 15] },
        {
            columns: [
                {
                    width: '50%',
                    stack: [
                        { text: 'BILL TO', style: 'sectionLabel' },
                        { text: invoice.client_name, bold: true, fontSize: 12 },
                        { text: invoice.client_address || '', fontSize: 10, color: '#666' },
                    ],
                },
                {
                    width: '50%',
                    alignment: 'right',
                    stack: [
                        { text: 'INVOICE', style: 'sectionLabel', alignment: 'right' },
                        { text: `#${invoice.invoice_number}`, bold: true, fontSize: 14, color: '#6366f1' },
                        { text: `Date: ${invoice.invoice_date}`, fontSize: 10, color: '#666' },
                        { text: `Period: ${invoice.from_date} to ${invoice.to_date}`, fontSize: 9, color: '#999' },
                    ],
                },
            ],
            margin: [0, 0, 0, 20],
        },
        {
            table: { headerRows: 1, widths: tableWidths, body: tableBody },
            layout: {
                hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
                vLineWidth: () => 0,
                hLineColor: (i) => i <= 1 ? '#ccc' : '#eee',
                paddingTop: () => 6,
                paddingBottom: () => 6,
                fillColor: (i) => i === 0 ? '#f8f9fa' : null,
            },
        },
        {
            columns: [
                { width: '*', text: '' },
                {
                    width: 'auto',
                    stack: [
                        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 2, lineColor: '#e2e8f0' }], margin: [0, 10, 0, 8] },
                        { text: 'TOTAL AMOUNT', fontSize: 9, color: '#999', alignment: 'right' },
                        { text: `₹${(invoice.final_amount || 0).toFixed(2)}`, fontSize: 20, bold: true, alignment: 'right', color: '#1a1a2e' },
                    ],
                },
            ],
        },
    ];

    // Insert logo if available
    if (logoBase64) {
        content.unshift({
            image: logoBase64,
            width: 50,
            alignment: 'center',
            margin: [0, 0, 0, 10]
        });
    }

    return {
        content,
        footer: (currentPage, pageCount) => {
            return {
                stack: [
                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#ddd' }], margin: [40, 0, 40, 10] },
                    {
                        columns: [
                            { text: invoice.owner_name ? `Authorized Signatory: ${invoice.owner_name}` : '', fontSize: 9, color: '#666', margin: [40, 0, 0, 0] },
                            { text: invoice.pan_id ? `PAN: ${invoice.pan_id}` : '', fontSize: 9, color: '#666', alignment: 'right', margin: [0, 0, 40, 0] },
                        ],
                    }
                ]
            };
        },
        styles: {
            companyName: { fontSize: 20, bold: true, color: '#1a1a2e', margin: [0, 0, 0, 4] },
            sectionLabel: { fontSize: 8, bold: true, color: '#999', letterSpacing: 1, margin: [0, 0, 0, 4] },
            tableHeader: { bold: true, fontSize: 8, color: '#555' },
        },
        defaultStyle: { font: 'Roboto', fontSize: 10 },
    };
}
