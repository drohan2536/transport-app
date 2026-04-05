import nodemailer from 'nodemailer';
import db from './db.js';

let emailTimer = null;
const CHECK_INTERVAL_MS = 60 * 1000; // Check every 1 minute

async function processScheduledEmails() {
    try {
        const smtp = db.prepare('SELECT * FROM smtp_config WHERE id = 1').get();
        if (!smtp || !smtp.host || !smtp.username || !smtp.password) {
            return; // SMTP not configured
        }

        const now = new Date().toISOString();
        const pendingEmails = db.prepare(`
            SELECT se.*, i.invoice_number, i.client_id, i.final_amount, i.invoice_date,
                c.name as client_name, co.name as company_name, co.email as company_email
            FROM scheduled_emails se
            JOIN invoices i ON se.invoice_id = i.id
            JOIN clients c ON i.client_id = c.id
            JOIN companies co ON i.company_id = co.id
            WHERE se.status = 'pending' AND se.scheduled_at <= ?
        `).all(now);

        if (pendingEmails.length === 0) return;

        console.log(`[EmailScheduler] 📬 Found ${pendingEmails.length} scheduled email(s) ready to send`);

        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.port === 465,
            auth: { user: smtp.username, pass: smtp.password },
            tls: { rejectUnauthorized: false }
        });

        for (const email of pendingEmails) {
            try {
                const contact = db.prepare("SELECT email FROM contact_persons WHERE client_id = ? AND email != '' LIMIT 1").get(email.client_id);
                if (!contact || !contact.email) {
                    db.prepare("UPDATE scheduled_emails SET status = 'failed', error_message = 'No email found for client' WHERE id = ?").run(email.id);
                    console.log(`[EmailScheduler] ❌ Scheduled email #${email.id} failed: No client email`);
                    continue;
                }

                await transporter.sendMail({
                    from: `"${email.company_name}" <${smtp.username}>`,
                    to: contact.email,
                    subject: `Invoice ${email.invoice_number} - ${email.company_name}`,
                    text: `Dear ${email.client_name},\n\nPlease find attached invoice ${email.invoice_number} dated ${email.invoice_date}.\n\nTotal Amount: ₹${email.final_amount.toFixed(2)}\n\nRegards,\n${email.company_name}`,
                    attachments: email.pdf_base64 ? [{
                        filename: `Invoice_${email.invoice_number}.pdf`,
                        content: email.pdf_base64,
                        encoding: 'base64'
                    }] : []
                });

                db.prepare("UPDATE scheduled_emails SET status = 'sent', sent_at = ? WHERE id = ?").run(new Date().toISOString(), email.id);
                console.log(`[EmailScheduler] ✅ Email #${email.id} sent to ${contact.email} — Invoice ${email.invoice_number}`);
            } catch (err) {
                db.prepare("UPDATE scheduled_emails SET status = 'failed', error_message = ? WHERE id = ?").run(err.message, email.id);
                console.error(`[EmailScheduler] ❌ Email #${email.id} failed:`, err.message);
            }
        }
    } catch (err) {
        console.error('[EmailScheduler] Error:', err.message);
    }
}

export function startEmailScheduler() {
    console.log('[EmailScheduler] 📧 Scheduled email processor started (checking every 1 minute)');

    // Run first check after 3 seconds
    setTimeout(() => {
        processScheduledEmails();
    }, 3000);

    // Then check every 1 minute
    emailTimer = setInterval(() => {
        processScheduledEmails();
    }, CHECK_INTERVAL_MS);
}

export function stopEmailScheduler() {
    if (emailTimer) {
        clearInterval(emailTimer);
        emailTimer = null;
        console.log('[EmailScheduler] ⏹️ Scheduled email processor stopped');
    }
}
