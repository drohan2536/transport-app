import nodemailer from 'nodemailer';
import db from './db.js';

let schedulerTimer = null;

function getSchedulerIntervalMs() {
    try {
        const row = db.prepare('SELECT scheduler_interval_minutes FROM app_settings WHERE id = 1').get();
        const minutes = row ? row.scheduler_interval_minutes : 60;
        return Math.max(1, minutes) * 60 * 1000;
    } catch {
        return 60 * 60 * 1000; // Fallback: 1 hour
    }
}

function getExpiryDays(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

async function sendReminderEmail(smtp, doc, diffDays) {
    const isExpired = diffDays < 0;
    const ownerName = doc.v_owner_name || doc.owner_name || 'Vehicle Owner';
    const recipientEmail = doc.v_owner_email || doc.owner_email || smtp.username;

    const statusText = isExpired
        ? `EXPIRED ${Math.abs(diffDays)} days ago (${doc.expiry_date})`
        : `expiring in ${diffDays} days (${doc.expiry_date})`;

    const subject = isExpired
        ? `🔴 EXPIRED: Vehicle Document - ${doc.vehicle_number} / ${doc.doc_name}`
        : `⚠️ EXPIRING SOON: Vehicle Document - ${doc.vehicle_number} / ${doc.doc_name}`;

    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: { user: smtp.username, pass: smtp.password },
        tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
        from: `"MorMukut Transport" <${smtp.username}>`,
        to: recipientEmail,
        subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: ${isExpired ? '#dc2626' : '#d97706'}; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0;">${isExpired ? '🔴 Document Expired' : '⚠️ Document Expiring Soon'}</h2>
                    <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 0.9em;">Automatic Reminder</p>
                </div>
                <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
                    <p style="margin: 0 0 16px 0; color: #374151;">Dear <strong>${ownerName}</strong>,</p>
                    <p style="color: #374151; margin: 0 0 16px 0;">
                        This is an automatic reminder that the following vehicle document is <strong style="color: ${isExpired ? '#dc2626' : '#d97706'}">${statusText}</strong>.
                    </p>
                    <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px;">
                        <tr>
                            <td style="padding: 10px 14px; font-weight: bold; color: #374151; width: 140px; border-bottom: 1px solid #e5e7eb;">Vehicle Number:</td>
                            <td style="padding: 10px 14px; color: #111; font-family: monospace; font-size: 1.1em; border-bottom: 1px solid #e5e7eb;">${doc.vehicle_number}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 14px; font-weight: bold; color: #374151; border-bottom: 1px solid #e5e7eb;">Document:</td>
                            <td style="padding: 10px 14px; color: #111; border-bottom: 1px solid #e5e7eb;">${doc.doc_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 14px; font-weight: bold; color: #374151; border-bottom: 1px solid #e5e7eb;">Start Date:</td>
                            <td style="padding: 10px 14px; color: #111; border-bottom: 1px solid #e5e7eb;">${doc.start_date}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 14px; font-weight: bold; color: #374151; border-bottom: 1px solid #e5e7eb;">Expiry Date:</td>
                            <td style="padding: 10px 14px; color: ${isExpired ? '#dc2626' : '#d97706'}; font-weight: bold; border-bottom: 1px solid #e5e7eb;">${doc.expiry_date}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 14px; font-weight: bold; color: #374151;">Status:</td>
                            <td style="padding: 10px 14px;">
                                <span style="background: ${isExpired ? '#fef2f2' : '#fffbeb'}; color: ${isExpired ? '#dc2626' : '#d97706'}; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 0.9em;">
                                    ${statusText}
                                </span>
                            </td>
                        </tr>
                    </table>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                    <p style="color: #6b7280; font-size: 0.85em; margin: 0;">
                        This is an automated reminder from MorMukut Transport Billing System.<br/>
                        Please renew the document at the earliest to avoid any issues.
                    </p>
                </div>
            </div>
        `
    });

    return recipientEmail;
}

async function checkAndSendReminders() {
    try {
        // Check SMTP config first
        const smtp = db.prepare('SELECT * FROM smtp_config WHERE id = 1').get();
        if (!smtp || !smtp.host || !smtp.username || !smtp.password) {
            return; // SMTP not configured, skip silently
        }

        // Find documents that are entering the ≤30 day window and haven't been reminded yet
        const docs = db.prepare(`
            SELECT vd.*,
                v.owner_name as v_owner_name,
                v.owner_email as v_owner_email
            FROM vehicle_documents vd
            LEFT JOIN vehicles v ON v.vehicle_number = vd.vehicle_number
            WHERE vd.reminder_sent = 0
        `).all();

        if (docs.length === 0) return;

        let sentCount = 0;
        for (const doc of docs) {
            const days = getExpiryDays(doc.expiry_date);

            // Only send for documents entering ≤30 day window (expiring soon or already expired)
            if (days > 30) continue;

            try {
                const recipient = await sendReminderEmail(smtp, doc, days);
                // Mark as reminded
                db.prepare('UPDATE vehicle_documents SET reminder_sent = 1 WHERE id = ?').run(doc.id);
                sentCount++;
                console.log(`[Scheduler] ✉️ Auto-reminder sent to ${recipient} for ${doc.vehicle_number} / ${doc.doc_name} (${days <= 0 ? 'EXPIRED' : days + ' days left'})`);
            } catch (err) {
                console.error(`[Scheduler] ❌ Failed to send reminder for ${doc.vehicle_number} / ${doc.doc_name}:`, err.message);
            }
        }

        if (sentCount > 0) {
            console.log(`[Scheduler] ✅ Sent ${sentCount} automatic expiry reminder(s)`);
        }
    } catch (err) {
        console.error('[Scheduler] Error in reminder check:', err.message);
    }
}

function scheduleNext() {
    const intervalMs = getSchedulerIntervalMs();
    const intervalMin = intervalMs / 60000;
    console.log(`[Scheduler] ⏱️ Next check in ${intervalMin} minute(s)`);
    schedulerTimer = setTimeout(() => {
        checkAndSendReminders().finally(() => {
            scheduleNext(); // Re-read interval from DB each cycle
        });
    }, intervalMs);
}

export function startExpiryScheduler() {
    const intervalMs = getSchedulerIntervalMs();
    const intervalMin = intervalMs / 60000;
    console.log('[Scheduler] 🕐 Vehicle document expiry reminder scheduler started');
    console.log(`[Scheduler] Checking every ${intervalMin} minute(s)`);

    // Run immediately on startup
    setTimeout(() => {
        console.log('[Scheduler] Running initial expiry check...');
        checkAndSendReminders().finally(() => {
            scheduleNext();
        });
    }, 5000); // Wait 5 seconds for server to fully start
}

export function restartExpiryScheduler() {
    if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
    }
    const intervalMs = getSchedulerIntervalMs();
    const intervalMin = intervalMs / 60000;
    console.log(`[Scheduler] 🔄 Scheduler restarted — new interval: ${intervalMin} minute(s)`);
    scheduleNext();
}
