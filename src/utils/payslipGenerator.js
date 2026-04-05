import { pdfMake, loadLogoBase64 } from './pdfGenerator.js';

function fmt(amount) {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
}

export function buildPayslipPdf(data, logoBase64) {
    const w = data.worker;
    const content = [];

    // ===== HEADER =====
    content.push({
        columns: [
            {
                width: '*',
                stack: [
                    { text: 'Krishna Govinda Tempo Services', bold: true, fontSize: 20, color: '#0f172a', margin: [0, 0, 0, 4] },
                    { text: 'SALARY PAYSLIP', bold: true, fontSize: 14, color: '#334155', letterSpacing: 1 }
                ]
            },
            {
                width: 'auto',
                stack: [
                    { text: 'Pay Period', fontSize: 9, bold: true, color: '#64748b', alignment: 'right', margin: [0, 0, 0, 2] },
                    { text: `${data.from_date} to ${data.to_date}`, fontSize: 11, bold: true, color: '#0f172a', alignment: 'right' }
                ]
            }
        ],
        margin: [0, 0, 0, 15]
    });

    // Separator
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#cbd5e1' }], margin: [0, 0, 0, 15] });

    // ===== WORKER DETAILS =====
    content.push({ text: 'Worker Details', bold: true, fontSize: 11, color: '#334155', margin: [0, 0, 0, 8] });

    content.push({
        table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [
                [
                    { text: 'Name', bold: true, fontSize: 9, color: '#64748b' },
                    { text: w.name, fontSize: 10, bold: true },
                    { text: 'Position', bold: true, fontSize: 9, color: '#64748b' },
                    { text: w.position.charAt(0).toUpperCase() + w.position.slice(1), fontSize: 10 }
                ],
                [
                    { text: 'Salary Type', bold: true, fontSize: 9, color: '#64748b' },
                    { text: w.salary_type.charAt(0).toUpperCase() + w.salary_type.slice(1), fontSize: 10 },
                    { text: 'Per Day Rate', bold: true, fontSize: 9, color: '#64748b' },
                    { text: `₹ ${fmt(w.per_day)}`, fontSize: 10, bold: true }
                ],
                [
                    { text: 'Contact', bold: true, fontSize: 9, color: '#64748b' },
                    { text: w.contact_no || '—', fontSize: 10 },
                    { text: 'Bank', bold: true, fontSize: 9, color: '#64748b' },
                    { text: w.bank_name ? `${w.bank_name} (${w.account_no || ''})` : '—', fontSize: 10 }
                ]
            ]
        },
        layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#e2e8f0',
            paddingTop: () => 6,
            paddingBottom: () => 6,
            paddingLeft: () => 8,
            paddingRight: () => 8,
        },
        margin: [0, 0, 0, 16]
    });

    // ===== ATTENDANCE SUMMARY =====
    content.push({ text: 'Attendance Summary', bold: true, fontSize: 11, color: '#334155', margin: [0, 0, 0, 8] });

    content.push({
        table: {
            widths: ['*', '*', '*'],
            body: [
                [
                    { text: 'Total Working Days', bold: true, fontSize: 9, color: '#64748b', alignment: 'center' },
                    { text: 'Days Present', bold: true, fontSize: 9, color: '#64748b', alignment: 'center' },
                    { text: 'Days Absent', bold: true, fontSize: 9, color: '#64748b', alignment: 'center' },
                ],
                [
                    { text: `${data.total_days}`, fontSize: 14, bold: true, alignment: 'center', color: '#334155' },
                    { text: `${data.present_days}`, fontSize: 14, bold: true, alignment: 'center', color: '#16a34a' },
                    { text: `${data.absent_count}`, fontSize: 14, bold: true, alignment: 'center', color: '#dc2626' },
                ]
            ]
        },
        layout: {
            hLineWidth: () => 0.5,
            vLineWidth: (i) => (i === 0 || i === 3) ? 0.5 : 0.3,
            hLineColor: () => '#e2e8f0',
            vLineColor: () => '#e2e8f0',
            paddingTop: () => 8,
            paddingBottom: () => 8,
            paddingLeft: () => 8,
            paddingRight: () => 8,
        },
        margin: [0, 0, 0, 8]
    });

    // Absent Days Detail (if any)
    if (data.absent_days && data.absent_days.length > 0) {
        const absentBody = [
            [
                { text: 'Sr.', bold: true, fontSize: 8, alignment: 'center' },
                { text: 'Date', bold: true, fontSize: 8 },
                { text: 'Remark', bold: true, fontSize: 8 }
            ]
        ];
        data.absent_days.forEach((a, i) => {
            absentBody.push([
                { text: `${i + 1}`, fontSize: 8, alignment: 'center' },
                { text: a.date, fontSize: 8 },
                { text: a.remark || '—', fontSize: 8, color: '#64748b' }
            ]);
        });

        content.push({ text: 'Absent Days:', fontSize: 9, bold: true, color: '#dc2626', margin: [0, 4, 0, 4] });
        content.push({
            table: { widths: [30, 80, '*'], body: absentBody },
            layout: {
                hLineWidth: () => 0.3, vLineWidth: () => 0.3,
                hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0',
                paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 4, paddingRight: () => 4,
            },
            margin: [0, 0, 0, 16]
        });
    } else {
        content.push({ text: '', margin: [0, 0, 0, 8] });
    }

    // ===== SALARY CALCULATION =====
    content.push({ text: 'Salary Calculation', bold: true, fontSize: 11, color: '#334155', margin: [0, 0, 0, 8] });

    content.push({
        table: {
            widths: ['*', 120],
            body: [
                [
                    { text: `Gross Salary  (${data.present_days} days × ₹${fmt(data.per_day)})`, fontSize: 10 },
                    { text: `₹ ${fmt(data.gross_salary)}`, fontSize: 10, bold: true, alignment: 'right' }
                ]
            ]
        },
        layout: {
            hLineWidth: () => 0.5, vLineWidth: () => 0,
            hLineColor: () => '#e2e8f0',
            paddingTop: () => 8, paddingBottom: () => 8, paddingLeft: () => 8, paddingRight: () => 8,
        },
        margin: [0, 0, 0, 8]
    });

    // ===== ADVANCES DETAIL =====
    if (data.advances && data.advances.length > 0) {
        content.push({ text: 'Advances Taken (Deductions)', bold: true, fontSize: 11, color: '#dc2626', margin: [0, 8, 0, 6] });

        const advBody = [
            [
                { text: 'Sr.', bold: true, fontSize: 8, alignment: 'center' },
                { text: 'Date', bold: true, fontSize: 8 },
                { text: 'Amount', bold: true, fontSize: 8, alignment: 'right' },
                { text: 'Mode', bold: true, fontSize: 8 },
                { text: 'Paid By', bold: true, fontSize: 8 },
                { text: 'Remark', bold: true, fontSize: 8 }
            ]
        ];
        data.advances.forEach((a, i) => {
            advBody.push([
                { text: `${i + 1}`, fontSize: 8, alignment: 'center' },
                { text: a.date, fontSize: 8 },
                { text: `₹ ${fmt(a.amount)}`, fontSize: 8, alignment: 'right', color: '#dc2626' },
                { text: a.mode_of_payment || '—', fontSize: 8 },
                { text: a.paid_by || '—', fontSize: 8 },
                { text: a.remark || '—', fontSize: 8, color: '#64748b' }
            ]);
        });
        // Total row
        advBody.push([
            { text: '', border: [true, true, false, true] },
            { text: 'Total Advances', bold: true, fontSize: 9, colSpan: 1 },
            { text: `₹ ${fmt(data.total_advances)}`, bold: true, fontSize: 9, alignment: 'right', color: '#dc2626' },
            { text: '', fontSize: 8 },
            { text: '', fontSize: 8 },
            { text: '', fontSize: 8 }
        ]);

        content.push({
            table: { widths: [25, 65, 70, 55, 70, '*'], body: advBody },
            layout: {
                hLineWidth: () => 0.3, vLineWidth: () => 0.3,
                hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0',
                paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 4, paddingRight: () => 4,
            },
            margin: [0, 0, 0, 8]
        });
    } else {
        content.push({
            text: [
                { text: 'Advances: ', bold: true, fontSize: 10, color: '#dc2626' },
                { text: 'None', fontSize: 10, color: '#64748b' }
            ],
            margin: [0, 8, 0, 8]
        });
    }

    // ===== PENDING DETAIL =====
    if (data.pendings && data.pendings.length > 0) {
        content.push({ text: 'Pending Amounts (Additions)', bold: true, fontSize: 11, color: '#16a34a', margin: [0, 8, 0, 6] });

        const penBody = [
            [
                { text: 'Sr.', bold: true, fontSize: 8, alignment: 'center' },
                { text: 'Date', bold: true, fontSize: 8 },
                { text: 'Amount', bold: true, fontSize: 8, alignment: 'right' },
                { text: 'Remark', bold: true, fontSize: 8 }
            ]
        ];
        data.pendings.forEach((p, i) => {
            penBody.push([
                { text: `${i + 1}`, fontSize: 8, alignment: 'center' },
                { text: p.date, fontSize: 8 },
                { text: `₹ ${fmt(p.amount)}`, fontSize: 8, alignment: 'right', color: '#16a34a' },
                { text: p.remark || '—', fontSize: 8, color: '#64748b' }
            ]);
        });
        penBody.push([
            { text: '', border: [true, true, false, true] },
            { text: 'Total Pending', bold: true, fontSize: 9 },
            { text: `₹ ${fmt(data.total_pending)}`, bold: true, fontSize: 9, alignment: 'right', color: '#16a34a' },
            { text: '', fontSize: 8 }
        ]);

        content.push({
            table: { widths: [25, 80, 80, '*'], body: penBody },
            layout: {
                hLineWidth: () => 0.3, vLineWidth: () => 0.3,
                hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0',
                paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 4, paddingRight: () => 4,
            },
            margin: [0, 0, 0, 8]
        });
    } else {
        content.push({
            text: [
                { text: 'Pending Amounts: ', bold: true, fontSize: 10, color: '#16a34a' },
                { text: 'None', fontSize: 10, color: '#64748b' }
            ],
            margin: [0, 8, 0, 8]
        });
    }

    // ===== EXTRA PAY DETAIL =====
    if (data.extra_pay_records && data.extra_pay_records.length > 0) {
        content.push({ text: 'Extra Pay (Sunday/Holiday Work)', bold: true, fontSize: 11, color: '#d97706', margin: [0, 8, 0, 6] });

        const extraBody = [
            [
                { text: 'Sr.', bold: true, fontSize: 8, alignment: 'center' },
                { text: 'Date', bold: true, fontSize: 8 },
                { text: 'Work Description', bold: true, fontSize: 8 },
                { text: 'Amount', bold: true, fontSize: 8, alignment: 'right' }
            ]
        ];
        data.extra_pay_records.forEach((r, i) => {
            extraBody.push([
                { text: `${i + 1}`, fontSize: 8, alignment: 'center' },
                { text: r.date, fontSize: 8 },
                { text: r.work_description || '—', fontSize: 8, color: '#64748b' },
                { text: `₹ ${fmt(r.extra_pay)}`, fontSize: 8, alignment: 'right', color: '#d97706' }
            ]);
        });
        extraBody.push([
            { text: '', border: [true, true, false, true] },
            { text: 'Total Extra Pay', bold: true, fontSize: 9, colSpan: 2 },
            {},
            { text: `₹ ${fmt(data.total_extra_pay)}`, bold: true, fontSize: 9, alignment: 'right', color: '#d97706' }
        ]);

        content.push({
            table: { widths: [25, 80, '*', 80], body: extraBody },
            layout: {
                hLineWidth: () => 0.3, vLineWidth: () => 0.3,
                hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0',
                paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 4, paddingRight: () => 4,
            },
            margin: [0, 0, 0, 8]
        });
    }

    // ===== NET PAY SUMMARY =====
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#94a3b8' }], margin: [0, 12, 0, 8] });

    const netPayBody = [
        [
            { text: 'Gross Salary', fontSize: 10, color: '#334155' },
            { text: `₹ ${fmt(data.gross_salary)}`, fontSize: 10, alignment: 'right' }
        ],
        [
            { text: '(−) Total Advances', fontSize: 10, color: '#dc2626' },
            { text: `− ₹ ${fmt(data.total_advances)}`, fontSize: 10, alignment: 'right', color: '#dc2626' }
        ],
        [
            { text: '(+) Total Pending', fontSize: 10, color: '#16a34a' },
            { text: `+ ₹ ${fmt(data.total_pending)}`, fontSize: 10, alignment: 'right', color: '#16a34a' }
        ]
    ];

    if (data.total_extra_pay > 0) {
        netPayBody.push([
            { text: '(+) Extra Pay', fontSize: 10, color: '#d97706' },
            { text: `+ ₹ ${fmt(data.total_extra_pay)}`, fontSize: 10, alignment: 'right', color: '#d97706' }
        ]);
    }

    netPayBody.push([
        { text: 'NET PAY', bold: true, fontSize: 12, color: '#0f172a' },
        { text: `₹ ${fmt(data.net_salary)}`, bold: true, fontSize: 14, alignment: 'right', color: data.net_salary >= 0 ? '#16a34a' : '#dc2626' }
    ]);

    content.push({
        table: {
            widths: ['*', 150],
            body: netPayBody
        },
        layout: {
            hLineWidth: (i, node) => i === node.table.body.length - 1 ? 1.5 : 0.5,
            vLineWidth: () => 0,
            hLineColor: (i, node) => i === node.table.body.length - 1 ? '#475569' : '#e2e8f0',
            paddingTop: (i, node) => i === node.table.body.length - 1 ? 10 : 6,
            paddingBottom: (i, node) => i === node.table.body.length - 1 ? 10 : 6,
            paddingLeft: () => 8,
            paddingRight: () => 8,
        },
        margin: [0, 0, 0, 16]
    });

    // ===== SIGNATURES =====
    content.push({
        columns: [
            { text: "Worker's Signature\n\n\n___________________", fontSize: 9, alignment: 'left', color: '#64748b' },
            { text: "Employer's Signature\n\n\n___________________", fontSize: 9, alignment: 'right', color: '#64748b' }
        ],
        margin: [0, 20, 0, 0]
    });

    return {
        content,
        footer: (currentPage, pageCount) => ({
            text: `Generated on ${new Date().toLocaleDateString('en-IN')} | Page ${currentPage} of ${pageCount} | Krishna Govinda Tempo Services`,
            alignment: 'center', fontSize: 8, color: '#94a3b8', margin: [0, 10, 0, 0]
        }),
        defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1e293b' },
        pageMargins: [40, 40, 40, 50],
    };
}

// View payslip in a new tab
export async function viewPayslip(salaryData) {
    const logoBase64 = await loadLogoBase64();
    const docDef = buildPayslipPdf(salaryData, logoBase64);
    pdfMake.createPdf(docDef).open();
}

// Download payslip
export async function downloadPayslip(salaryData) {
    const logoBase64 = await loadLogoBase64();
    const docDef = buildPayslipPdf(salaryData, logoBase64);
    const fileName = `Payslip_${salaryData.worker.name.replace(/\s+/g, '_')}_${salaryData.from_date}_to_${salaryData.to_date}.pdf`;
    pdfMake.createPdf(docDef).download(fileName);
}
