import nodemailer from "nodemailer";

export type EmailNotifier = {
  notifyNewRelease(email: string, repository: string, tagName: string, releaseUrl: string): Promise<void>;
};

export class SmtpEmailNotifier implements EmailNotifier {
  private readonly transporter;

  constructor(options: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  }) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: false,
      auth: options.user ? { user: options.user, pass: options.pass } : undefined
    });
    this.from = options.from;
  }

  private readonly from: string;

  async notifyNewRelease(email: string, repository: string, tagName: string, releaseUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: `New release in ${repository}: ${tagName}`,
      text: `A new release ${tagName} is available for ${repository}. URL: ${releaseUrl}`
    });
  }
}
