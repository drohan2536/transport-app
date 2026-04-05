import logoUrl from '../assets/logo.svg';
import { devanagariBase64 } from '../assets/devanagariFont.js';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import pdfMake from 'pdfmake/build/pdfmake';

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

// Setup fonts for pdfMake
export const setupPdfFonts = (vfsObj) => {
    // If vfsObj is provided, use it. Otherwise, try to extract the base vfs from the imported pdfFonts module.
    // Vite CJS-to-ESM interop might put the vfs object in .default, or it might be the module namespace itself.
    const baseVfs = vfsObj || (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) || pdfFonts?.vfs || pdfFonts?.default || pdfFonts || {};

    const finalVfs = { ...baseVfs };

    // Inject custom font map
    finalVfs['Mangal.ttf'] = devanagariBase64;

    const fonts = {
        Roboto: {
            normal: 'Roboto-Regular.ttf',
            bold: 'Roboto-Medium.ttf',
            italics: 'Roboto-Italic.ttf',
            bolditalics: 'Roboto-MediumItalic.ttf'
        },
        Mangal: {
            normal: 'Mangal.ttf',
            bold: 'Mangal.ttf',
            italics: 'Mangal.ttf',
            bolditalics: 'Mangal.ttf'
        }
    };

    // Also update global pdfMake straight away for convenience if needed
    pdfMake.vfs = finalVfs;
    pdfMake.fonts = fonts;

    return { fonts, vfs: finalVfs };
};

// Initialize fonts right away
setupPdfFonts();

export { pdfMake };

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
        weight: { header: 'Weight', width: 'auto', align: 'right', val: e => e.weight },
        rate_per_kg: { header: 'Rate/Kg', width: 'auto', align: 'right', val: e => e.rate_per_kg },
        no_of_bundles: { header: 'Bundles', width: 'auto', val: e => e.no_of_bundles },
        rate_per_bundle: { header: 'Rate/Bdl', width: 'auto', align: 'right', val: e => e.rate_per_bundle },
        amount: { header: 'Amount', width: 'auto', align: 'right', val: e => `${(e.amount || 0).toFixed(2)}/-` },
        loading_charges: { header: 'Loading', width: 'auto', align: 'right', val: e => e.loading_charges ? `${e.loading_charges}/-` : '-' },
        total_amount: { header: 'Total', width: 'auto', align: 'right', bold: true, val: e => `${(e.total_amount || 0).toFixed(2)}/-` },
    };

    // Build table headers — always include Sr. no.
    const tableHeaders = [{ text: 'Sr. no.', bold: true, alignment: 'center', fontSize: 9 }];
    const tableWidths = [30];

    visibleColIds.forEach(id => {
        const def = colDefs[id];
        if (def) {
            tableHeaders.push({ text: def.header, bold: true, alignment: def.align || 'center', fontSize: 9 });
            tableWidths.push(def.width || 'auto');
        }
    });

    const tableBody = [tableHeaders];

    // Data rows
    entries.forEach((e, i) => {
        const row = [{ text: (i + 1).toString(), alignment: 'center', fontSize: 9 }];
        visibleColIds.forEach(id => {
            const def = colDefs[id];
            if (def) {
                let cellVal = def.val(e);
                if (cellVal === undefined || cellVal === null || cellVal === '') cellVal = '-';
                row.push({
                    text: String(cellVal),
                    alignment: def.align || 'left',
                    bold: def.bold || false,
                    fontSize: 9
                });
            }
        });
        tableBody.push(row);
    });

    // Calculate entries total (before adjustment)
    const entriesTotal = entries.reduce((sum, e) => sum + (e.total_amount || 0), 0);
    const hasAdjustment = invoice.adjustment_type && invoice.adjustment_amount > 0;

    // Total Amount row — spans all columns except the last one
    const totalColCount = 1 + visibleColIds.length; // Sr. no. + visible cols
    const buildSummaryRow = (label, amount, opts = {}) => {
        const { color = '#1e3a8a', fontSize = 10, bold = true } = opts;
        const row = [];
        if (totalColCount > 2) {
            row.push({ text: '', border: [true, true, false, true] }); // Sr. no. cell empty
            row.push({
                text: label,
                bold,
                fontSize,
                color,
                alignment: 'center',
                colSpan: totalColCount - 2,
                border: [false, true, true, true]
            });
            // Fill colSpan placeholders
            for (let i = 0; i < totalColCount - 3; i++) {
                row.push({});
            }
            row.push({
                text: amount,
                bold,
                fontSize,
                color,
                alignment: 'right'
            });
        } else {
            row.push({ text: label, bold, fontSize, color, alignment: 'center' });
            row.push({ text: amount, bold, fontSize, color, alignment: 'right' });
        }
        return row;
    };

    if (hasAdjustment) {
        // Row 1: Total Amount (entries total before adjustment)
        tableBody.push(buildSummaryRow('Total Amount', `${entriesTotal.toFixed(2)}/-`));

        // Row 2: Adding/Subtracting (reason) with adjustment amount
        const adjLabel = invoice.adjustment_type === 'addition'
            ? `Adding (${invoice.adjustment_reason || ''})`
            : `Subtracting (${invoice.adjustment_reason || ''})`;
        const adjSign = invoice.adjustment_type === 'addition' ? '+' : '−';
        const adjColor = invoice.adjustment_type === 'addition' ? '#16a34a' : '#dc2626';
        tableBody.push(buildSummaryRow(adjLabel, `${adjSign}${invoice.adjustment_amount.toFixed(2)}/-`, { color: adjColor, fontSize: 9, bold: false }));

        // Row 3: Final Amount
        tableBody.push(buildSummaryRow('Final Amount', `${(invoice.final_amount || 0).toFixed(2)}/-`, { fontSize: 11 }));
    } else {
        // No adjustment — single Total Amount row
        tableBody.push(buildSummaryRow('Total Amount', `${(invoice.final_amount || 0).toFixed(2)}/-`));
    }

    // --- Build content ---
    const content = [];

    // 1. Sanskrit Header
    content.push({
        text: '॥ श्री कृष्णं वन्दे जगद्गुरुम् ॥',
        font: 'Mangal',
        bold: true,
        fontSize: 10,
        color: '#dc2626',
        alignment: 'center',
        margin: [0, 0, 0, 8]
    });

    // 2. Company Logo + Details Header
    const companyHeaderColumns = [];
    if (logoBase64) {
        companyHeaderColumns.push({ image: logoBase64, width: 80, alignment: 'left' });
    }

    const companyDetailsStack = [
        { text: invoice.company_name || 'TRANSPORT COMPANY', bold: true, fontSize: 24, color: '#0f172a', margin: [0, 0, 0, 4] }
    ];
    if (invoice.company_address) {
        companyDetailsStack.push({ text: invoice.company_address, fontSize: 10, color: '#334155', margin: [0, 0, 0, 2] });
    }
    if (invoice.company_phone) {
        companyDetailsStack.push({ text: 'Mob: ' + invoice.company_phone, fontSize: 10, color: '#334155' });
    }

    companyHeaderColumns.push({
        width: '*',
        stack: companyDetailsStack,
        alignment: logoBase64 ? 'right' : 'center'
    });

    content.push({
        columns: companyHeaderColumns,
        margin: [0, 0, 0, 15]
    });

    // Divider & Title
    content.push({
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#cbd5e1' }],
        margin: [0, 0, 0, 15]
    });
    content.push({
        text: 'INVOICE',
        bold: true,
        fontSize: 16,
        alignment: 'center',
        letterSpacing: 2,
        color: '#1e3a8a',
        margin: [0, -8, 0, 20]
    });

    // 3. Client & Bill Info row
    content.push({
        columns: [
            {
                width: '60%',
                stack: [
                    { text: 'Bill To:', fontSize: 9, bold: true, color: '#64748b', margin: [0, 0, 0, 2] },
                    { text: invoice.client_name || 'Client', bold: true, fontSize: 12, color: '#0f172a' },
                    ...(invoice.client_address ? [{ text: invoice.client_address, fontSize: 10, color: '#334155', margin: [0, 2, 0, 0] }] : [])
                ]
            },
            {
                width: '40%',
                stack: [
                    {
                        columns: [
                            { text: 'Invoice No:', fontSize: 10, bold: true, color: '#64748b', width: 70 },
                            { text: invoice.invoice_number || '', bold: true, fontSize: 11, color: '#dc2626', alignment: 'right' }
                        ],
                        margin: [0, 0, 0, 4]
                    },
                    {
                        columns: [
                            { text: 'Date:', fontSize: 10, bold: true, color: '#64748b', width: 70 },
                            { text: invoice.invoice_date || '', fontSize: 10, alignment: 'right', color: '#0f172a' }
                        ]
                    }
                ],
                alignment: 'right'
            }
        ],
        margin: [0, 0, 0, 20]
    });

    // 4. Data Table with clean styling
    content.push({
        table: {
            headerRows: 1,
            widths: tableWidths,
            body: tableBody
        },
        layout: {
            hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1.5 : 0.5,
            vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1.5 : 0.5,
            hLineColor: () => '#94a3b8',
            vLineColor: () => '#94a3b8',
            fillColor: (rowIndex, node) => {
                if (rowIndex === 0) return '#f1f5f9';
                if (rowIndex >= node.table.body.length - (hasAdjustment ? 3 : 1)) return '#f8fafc';
                return null;
            },
            paddingTop: (i, node) => (i === 0 || i >= node.table.body.length - (hasAdjustment ? 3 : 1)) ? 8 : 6,
            paddingBottom: (i, node) => (i === 0 || i >= node.table.body.length - (hasAdjustment ? 3 : 1)) ? 8 : 6,
            paddingLeft: () => 6,
            paddingRight: () => 6,
        },
    });

    // 5. Footer and Background border
    return {
        background: function (currentPage, pageSize) {
            return {
                canvas: [
                    { type: 'rect', x: 20, y: 20, w: pageSize.width - 40, h: pageSize.height - 40, lineWidth: 1, lineColor: '#cbd5e1' }
                ]
            };
        },
        content,
        footer: (currentPage, pageCount) => {
            return {
                columns: [
                    {
                        text: invoice.pan_id ? `PAN NO: ${invoice.pan_id}` : '',
                        bold: true,
                        fontSize: 9,
                        margin: [40, 10, 0, 0],
                        color: '#475569'
                    },
                    {
                        text: invoice.owner_name ? `Auth. Signatory: \n\n${invoice.owner_name}` : '',
                        bold: true,
                        fontSize: 9,
                        alignment: 'right',
                        margin: [0, 10, 40, 0],
                        color: '#475569'
                    }
                ]
            };
        },
        styles: {
            tableHeader: { bold: true, fontSize: 9, color: '#334155' },
        },
        defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1e293b' },
        pageMargins: [40, 40, 40, 70],
    };
}
