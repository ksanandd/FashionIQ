const nodemailer = require("nodemailer");

/**
 * FashionIQ Email Service
 * Handles transactional email delivery with configurable SMTP settings.
 * If SMTP is not configured:
 *  - In development: Logs reset link safely to console and provides test metadata.
 *  - In production: Fails safely without leaking tokens.
 */

const getSmtpConfig = () => {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const from = process.env.EMAIL_FROM || "FashionIQ <no-reply@fashioniq.com>";

    const isConfigured = Boolean(host && user && pass);

    return { host, port, user, pass, secure, from, isConfigured };
};

/**
 * Sends a password reset email to the specified user.
 *
 * @param {Object} options
 * @param {string} options.toEmail
 * @param {string} options.userName
 * @param {string} options.resetToken
 * @param {string} options.resetUrl
 * @returns {Promise<{ success: boolean, method: string, messageId?: string, error?: string }>}
 */
const sendPasswordResetEmail = async ({ toEmail, userName, resetToken, resetUrl }) => {
    const config = getSmtpConfig();
    const isProd = process.env.NODE_ENV === "production";

    if (config.isConfigured) {
        try {
            const transporter = nodemailer.createTransport({
                host: config.host,
                port: config.port,
                secure: config.secure,
                auth: {
                    user: config.user,
                    pass: config.pass,
                },
            });

            const mailOptions = {
                from: config.from,
                to: toEmail,
                subject: "Reset Your FashionIQ Password",
                text: `Hello ${userName || "FashionIQ Member"},\n\n` +
                    `We received a request to reset your password for your FashionIQ account.\n\n` +
                    `Click the link below to set a new password:\n` +
                    `${resetUrl}\n\n` +
                    `This link is valid for 15 minutes and can only be used once.\n\n` +
                    `If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.\n\n` +
                    `Best regards,\nThe FashionIQ Team`,
                html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #faf9f6; margin: 0; padding: 20px; color: #1f2937; }
                        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                        .header { background: #111827; padding: 28px 32px; text-align: center; }
                        .logo { font-size: 26px; font-weight: 700; color: #ffffff; text-decoration: none; letter-spacing: -0.04em; }
                        .logo span { color: #c65b3b; }
                        .content { padding: 36px 32px; }
                        h2 { font-size: 22px; margin-top: 0; color: #111827; font-weight: 600; }
                        p { font-size: 14px; line-height: 1.6; color: #4b5563; margin: 16px 0; }
                        .btn-container { text-align: center; margin: 32px 0; }
                        .btn { display: inline-block; background-color: #111827; color: #ffffff !important; padding: 14px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 9999px; }
                        .btn:hover { background-color: #000000; }
                        .note { font-size: 12px; color: #6b7280; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 24px; }
                        .footer { background: #f9fafb; padding: 16px 32px; text-align: center; font-size: 12px; color: #9ca3af; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">fashion<span>IQ</span></div>
                        </div>
                        <div class="content">
                            <h2>Password Reset Request</h2>
                            <p>Hello ${userName || "FashionIQ Member"},</p>
                            <p>We received a request to reset the password for your FashionIQ account associated with <strong>${toEmail}</strong>.</p>
                            <div class="btn-container">
                                <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
                            </div>
                            <p>This password reset link is time-limited to <strong>15 minutes</strong> and can only be used once.</p>
                            <p class="note">If you did not request a password reset, you can safely ignore this email. Your account remains completely secure.</p>
                        </div>
                        <div class="footer">
                            &copy; ${new Date().getFullYear()} FashionIQ. All rights reserved.
                        </div>
                    </div>
                </body>
                </html>
                `,
            };

            const info = await transporter.sendMail(mailOptions);
            return {
                success: true,
                method: "smtp",
                messageId: info.messageId,
            };
        } catch (error) {
            console.error("[EMAIL SERVICE ERROR] Failed to dispatch SMTP email:", error.message);
            return {
                success: false,
                method: "smtp",
                error: error.message,
            };
        }
    }

    // SMTP not configured
    if (!isProd) {
        console.log("--------------------------------------------------------------------------------");
        console.log(`[DEVELOPMENT MODE - EMAIL SERVICE] Password reset requested for: ${toEmail}`);
        console.log(`[DEVELOPMENT MODE - EMAIL SERVICE] Reset URL: ${resetUrl}`);
        console.log(`[DEVELOPMENT MODE - EMAIL SERVICE] (Configure SMTP_HOST, SMTP_USER, SMTP_PASS in backend/.env for real delivery)`);
        console.log("--------------------------------------------------------------------------------");
        return {
            success: true,
            method: "development_log",
        };
    }

    // Production without SMTP configured
    console.warn(
        `[EMAIL SERVICE WARNING] SMTP is not configured in production environment. Password reset email could not be sent to recipient.`
    );
    return {
        success: false,
        method: "unconfigured_production",
        error: "SMTP service unconfigured in production",
    };
};

module.exports = {
    getSmtpConfig,
    sendPasswordResetEmail,
};
