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
        fontSize: 11,
        color: '#dc2626', // Deep red for Sanskrit header
        alignment: 'center',
        margin: [0, 0, 0, 6]
    });

    // 2. Company Logo + Name
    if (logoBase64) {
        content.push({
            columns: [
                { width: '*', text: '' },
                { image: logoBase64, width: 70, alignment: 'center' },
                {
                    width: 'auto',
                    text: invoice.company_name || 'TEMPO SERVICES',
                    bold: true,
                    fontSize: 18,
                    color: '#1e40af', // Blue company name
                    alignment: 'center',
                    margin: [10, 8, 10, 0]
                },
                { image: logoBase64, width: 70, alignment: 'center' },
                { width: '*', text: '' },
            ],
            margin: [0, 0, 0, 4]
        });
    } else {
        content.push({
            text: invoice.company_name || 'Transport Company', style: 'companyName', alignment: 'center'
        });
        content.push({ text: invoice.company_address || '', alignment: 'center', fontSize: 10, color: '#666', margin: [0, 0, 0, 2] });
    }

    // 3. Company Address + Phone
    const addressParts = [];
    if (invoice.company_address) addressParts.push(invoice.company_address);
    if (invoice.company_phone) addressParts.push(`Mob. no. : ${invoice.company_phone}`);
    if (addressParts.length > 0) {
        content.push({
            text: addressParts.join('. ') + '.',
            fontSize: 9,
            alignment: 'center',
            margin: [0, 0, 0, 12]
        });
    }

    // 4. Client Name + Bill Number row
    content.push({
        columns: [
            {
                width: '60%',
                text: [
                    { text: 'Company Name :-  ', fontSize: 10, color: '#475569' },
                    { text: invoice.client_name || 'Client', bold: true, fontSize: 13, color: '#0f172a' },
                ]
            },
            {
                width: '40%',
                alignment: 'right',
                text: [
                    { text: 'Bill no. : ', fontSize: 10, color: '#475569' },
                    { text: invoice.invoice_number || '', bold: true, fontSize: 11, color: '#dc2626' }
                ]
            }
        ],
        margin: [0, 8, 0, 2] // Added top margin
    });

    // Client Address
    if (invoice.client_address) {
        content.push({
            text: invoice.client_address,
            fontSize: 10,
            color: '#666',
            margin: [0, 4, 0, 8] // top, right, bottom, left
        });
    }

    // 5. Date row
    content.push({
        text: [
            { text: 'Date    :  ', fontSize: 10 },
            { text: invoice.invoice_date || '', bold: true, fontSize: 10 }
        ],
        alignment: 'right',
        margin: [0, 0, 0, 10]
    });

    // 6. Data Table with full borders
    content.push({
        table: {
            headerRows: 1,
            widths: tableWidths,
            body: tableBody
        },
        layout: {
            hLineWidth: () => 0.8,
            vLineWidth: () => 0.8,
            hLineColor: () => '#555555',
            vLineColor: () => '#555555',
            paddingTop: () => 5,
            paddingBottom: () => 5,
            paddingLeft: () => 4,
            paddingRight: () => 4,
        },
    });

    // 7. Footer — PAN + Owner/Signatory & background border
    return {
        background: function (currentPage, pageSize) {
            return {
                canvas: [
                    { type: 'rect', x: 20, y: 20, w: pageSize.width - 40, h: pageSize.height - 40, lineWidth: 1.5, lineColor: '#1e3a8a' }
                ]
            };
        },
        content,
        footer: (currentPage, pageCount) => {
            return {
                columns: [
                    {
                        text: invoice.pan_id ? `PAN NO. :- ${invoice.pan_id}` : '',
                        bold: true,
                        fontSize: 9,
                        margin: [40, 10, 0, 0]
                    },
                    {
                        text: invoice.owner_name || '',
                        bold: true,
                        fontSize: 9,
                        alignment: 'right',
                        margin: [0, 10, 40, 0]
                    }
                ]
            };
        },
        styles: {
            tableHeader: { bold: true, fontSize: 9 },
        },
        defaultStyle: { font: 'Roboto', fontSize: 10 },
        pageMargins: [40, 40, 40, 60],
    };
}
