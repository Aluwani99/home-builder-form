import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

export async function sendConfirmationEmail(formData) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"NHBRC" <${process.env.EMAIL_FROM}>`,
    to: formData.email,
    subject: 'Registration Form Submitted',
    html: `<p>Dear ${formData.name || 'User'},<br>Your form has been successfully submitted.</p>`,
  };

  await transporter.sendMail(mailOptions);
}
