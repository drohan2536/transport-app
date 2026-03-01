
import chalk from 'chalk';
import { fetch } from 'undici';

const BASE_URL = 'http://localhost:3002/api';

async function verify() {
    console.log(chalk.blue('Starting Invoice API Verification...'));

    try {
        // 1. Get All Invoices
        console.log('Fetching all invoices...');
        const resList = await fetch(`${BASE_URL}/invoices`);
        if (!resList.ok) throw new Error(`List failed: ${resList.statusText}`);
        const invoices = await resList.json();
        console.log(chalk.green(`✓ Found ${invoices.length} invoices`));

        if (invoices.length === 0) {
            console.log(chalk.yellow('No invoices to test. Please create one manually if possible.'));
            return;
        }

        const invId = invoices[0].id;
        console.log(`Testing Invoice ID: ${invId}`);

        // 2. Get Single Invoice
        console.log('Fetching single invoice...');
        const resOne = await fetch(`${BASE_URL}/invoices/${invId}`);
        if (!resOne.ok) {
            const err = await resOne.text();
            throw new Error(`Get Single failed: ${resOne.status} - ${err}`);
        }
        const invoice = await resOne.json();
        console.log(chalk.green('✓ Fetched invoice successfully'));
        console.log('Invoice Keys:', Object.keys(invoice));

        // 3. Check for specific fields used in Frontend
        const required = ['client_name', 'client_address', 'company_name', 'entries', 'owner_name', 'pan_id', 'invoice_visible_columns'];
        const missing = required.filter(k => invoice[k] === undefined);
        if (missing.length > 0) {
            console.log(chalk.red(`✗ Missing fields: ${missing.join(', ')}`));
        } else {
            console.log(chalk.green('✓ All required fields present'));
        }

    } catch (err) {
        console.error(chalk.red('Verification Failed:'), err.message);
    }
}

verify();
