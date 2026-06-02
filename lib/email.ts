import nodemailer from "nodemailer";

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  // 開発用：SMTP設定がない場合はコンソールに表示するだけにする
  if (!process.env.SMTP_HOST) {
    console.log(`\n=========================================`);
    console.log(`[Mock Email] To: ${email}`);
    console.log(`[Mock Email] 認証コード: ${code}`);
    console.log(`=========================================\n`);
    return;
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"MineModCraft Studio" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "【MineModCraft Studio】メールアドレスの認証",
    html: `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0d0d0f;border:1px solid #2d2d35;border-radius:16px;padding:40px;">

        <!-- Logo -->
        <tr><td style="text-align:center;padding-bottom:32px;">
          <span style="color:#6c5ce7;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
            ⬡ MineModCraft Studio
          </span>
        </td></tr>

        <!-- Title -->
        <tr><td style="padding-bottom:8px;">
          <p style="margin:0;color:#e8e8ec;font-size:20px;font-weight:600;">
            メールアドレスの認証
          </p>
        </td></tr>

        <!-- Subtitle -->
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0;color:#72727e;font-size:14px;line-height:1.6;">
            以下の6桁の認証コードを入力して、アカウント登録を完了してください。
          </p>
        </td></tr>

        <!-- Code box -->
        <tr><td style="padding-bottom:28px;">
          <table width="100%" cellpadding="0" cellspacing="0"
            style="background:#18181c;border:1px solid #2d2d35;border-radius:12px;padding:28px 0;">
            <tr><td style="text-align:center;">
              <p style="margin:0 0 8px;color:#72727e;font-size:12px;letter-spacing:2px;text-transform:uppercase;">
                認証コード
              </p>
              <p style="margin:0;color:#6c5ce7;font-size:44px;font-weight:700;letter-spacing:14px;font-family:'Courier New',monospace;">
                ${code}
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Note -->
        <tr><td>
          <p style="margin:0;color:#72727e;font-size:13px;line-height:1.6;">
            このコードは <strong style="color:#e8e8ec;">10分間</strong> 有効です。<br />
            心当たりのない場合は、このメールを無視してください。
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
    text: `MineModCraft Studio — メールアドレスの認証\n\n認証コード: ${code}\n\nこのコードは10分間有効です。心当たりのない場合は無視してください。`,
  });
}
